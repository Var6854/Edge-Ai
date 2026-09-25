/**
 * Master Simulation Engine for Edge-AI AMR Fleet Coordination
 * Coordinates independent EdgeRobotAgents, P2P network, conflict resolution,
 * deadlock recovery, dynamic task allocation, and authoritative state broadcasts.
 */

import {
  ConflictEvent,
  Position,
  RobotMessage,
  RobotState,
  SimulationEvent,
  SimulationState,
  Task,
  TaskPriority,
} from '../../shared/types.ts';
import { P2PNetwork } from './communication.ts';
import { ConflictEngine } from './conflict.ts';
import { DeadlockDetector } from './deadlock.ts';
import { MetricsEngine } from './metrics.ts';
import { EdgeRobotAgent } from './robot.ts';
import { TaskAllocator } from './task_allocator.ts';
import { Warehouse } from './warehouse.ts';

export class WarehouseSimulation {
  public warehouse: Warehouse;
  public network: P2PNetwork;
  public robots: Map<string, EdgeRobotAgent> = new Map();
  public taskAllocator: TaskAllocator;
  public conflictEngine: ConflictEngine;
  public deadlockDetector: DeadlockDetector;
  public metricsEngine: MetricsEngine;

  public tick: number = 0;
  public running: boolean = true;
  public speedMultiplier: number = 1.0;
  public mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT' = 'DISTRIBUTED';

  public events: SimulationEvent[] = [];
  public maxEvents: number = 150;

  // Active time-space reservations: "x,y,tick" -> robot_id
  public reservations: Map<string, string> = new Map();
  private eventCounter: number = 0;

  // Congestion grid: [x][y] -> float 0 to 1
  public congestionGrid: number[][] = [];

  // Listeners for WebSocket broadcasts
  private stateChangeListeners: ((state: SimulationState) => void)[] = [];

  constructor() {
    this.warehouse = new Warehouse();
    this.network = new P2PNetwork();
    this.taskAllocator = new TaskAllocator(this.warehouse);
    this.conflictEngine = new ConflictEngine();
    this.deadlockDetector = new DeadlockDetector();
    this.metricsEngine = new MetricsEngine();

    this.initCongestionGrid();
    this.initializeFleet();
    this.seedInitialTasks();
  }

  private initCongestionGrid(): void {
    this.congestionGrid = Array.from({ length: this.warehouse.width }, () =>
      Array.from({ length: this.warehouse.height }, () => 0)
    );
  }

  public initializeFleet(): void {
    this.robots.clear();
    this.network.clearHistory();

    const robotConfigs: { id: string; name: string; color: string; pos: Position }[] = [
      { id: 'R1', name: 'AMR Unit Alpha', color: '#3B82F6', pos: [3, 2] },
      { id: 'R2', name: 'AMR Unit Beta', color: '#10B981', pos: [11, 2] },
      { id: 'R3', name: 'AMR Unit Gamma', color: '#F59E0B', pos: [19, 2] },
      { id: 'R4', name: 'AMR Unit Delta', color: '#8B5CF6', pos: [27, 2] },
      { id: 'R5', name: 'AMR Unit Epsilon', color: '#EC4899', pos: [15, 9] },
    ];

    for (const cfg of robotConfigs) {
      const agent = new EdgeRobotAgent(
        cfg.id,
        cfg.name,
        cfg.color,
        cfg.pos,
        this.warehouse,
        this.network
      );
      this.robots.set(cfg.id, agent);
    }
  }

  public seedInitialTasks(): void {
    const tasksData: {
      pickup: Position;
      delivery: Position;
      pName: string;
      dName: string;
      priority: TaskPriority;
    }[] = [
      {
        pickup: [3, 1],
        delivery: [11, 18],
        pName: 'Pickup A',
        dName: 'Station 2',
        priority: 'HIGH',
      },
      {
        pickup: [11, 1],
        delivery: [19, 18],
        pName: 'Pickup B',
        dName: 'Station 3',
        priority: 'MEDIUM',
      },
      {
        pickup: [19, 1],
        delivery: [3, 18],
        pName: 'Pickup C',
        dName: 'Station 1',
        priority: 'CRITICAL',
      },
      {
        pickup: [27, 1],
        delivery: [27, 18],
        pName: 'Pickup D',
        dName: 'Station 4',
        priority: 'MEDIUM',
      },
      {
        pickup: [11, 1],
        delivery: [27, 18],
        pName: 'Pickup B',
        dName: 'Station 4',
        priority: 'LOW',
      },
      {
        pickup: [19, 1],
        delivery: [11, 18],
        pName: 'Pickup C',
        dName: 'Station 2',
        priority: 'HIGH',
      },
    ];

    for (const t of tasksData) {
      const created = this.taskAllocator.createTask(
        t.pickup,
        t.delivery,
        t.pName,
        t.dName,
        t.priority,
        this.tick
      );
      this.logEvent(
        'TASK_CREATED',
        'info',
        `Task Created: ${created.id}`,
        `Route from ${t.pName} to ${t.dName} [Priority: ${t.priority}]`
      );
    }
  }

  public addStateChangeListener(cb: (state: SimulationState) => void): void {
    this.stateChangeListeners.push(cb);
  }

  public removeStateChangeListener(cb: (state: SimulationState) => void): void {
    this.stateChangeListeners = this.stateChangeListeners.filter((c) => c !== cb);
  }

  public setMode(mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT'): void {
    this.mode = mode;
    this.metricsEngine.mode = mode;
    this.logEvent(
      'TASK_CREATED',
      'info',
      `Simulation Mode Changed`,
      `Coordination mode set to: ${mode}`
    );
  }

  public reset(keepTasks: boolean = false): void {
    this.tick = 0;
    this.events = [];
    this.reservations.clear();
    this.conflictEngine.clear();
    this.metricsEngine.reset(this.mode);
    this.warehouse.initializeDefaultLayout();
    this.initializeFleet();
    this.initCongestionGrid();

    if (!keepTasks) {
      this.taskAllocator = new TaskAllocator(this.warehouse);
      this.seedInitialTasks();
    } else {
      for (const t of this.taskAllocator.taskQueue) {
        t.status = 'PENDING';
        t.assignedRobotId = undefined;
      }
    }

    this.broadcastState();
  }

  /**
   * Main Simulation Clock Tick (runs authoritative multi-agent cycle).
   */
  public step(): void {
    this.tick++;
    this.metricsEngine.currentTick = this.tick;

    // 1. Update Congestion Heatmap
    this.updateCongestionGrid();

    // 2. Robots broadcast their peer intent packets
    for (const robot of this.robots.values()) {
      if (!robot.failed) {
        robot.priority = this.conflictEngine.calculatePriority(robot.toState());
        robot.broadcastIntent(this.tick);
      }
    }

    // 3. Dynamic Task Allocation
    const robotStateList = Array.from(this.robots.values()).map((r) => r.toState());
    const { assigned } = this.taskAllocator.allocateTasks(
      robotStateList,
      this.tick,
      this.congestionGrid
    );

    for (const item of assigned) {
      const robot = this.robots.get(item.robotId);
      if (robot) {
        robot.assignTask(item.task, this.tick);
        this.logEvent(
          'TASK_ASSIGNED',
          'info',
          `Task Assigned: ${item.task.id}`,
          `Assigned to ${robot.id} for pickup at ${item.task.pickupName}`,
          robot.id,
          item.task.pickup
        );
      }
    }

    // 4. Check for Invalidation of Paths (e.g. Blocked Aisles)
    for (const robot of this.robots.values()) {
      if (robot.failed || robot.status === 'IDLE') continue;

      if (robot.isPlannedPathBlocked()) {
        this.logEvent(
          'ROBOT_REROUTING',
          'warning',
          `Path Blocked for ${robot.id}`,
          `Detected blocked cell on planned route; recalculating path using A*`,
          robot.id,
          robot.position
        );
        const rerouted = robot.replanPath(this.congestionGrid);
        if (rerouted) {
          this.metricsEngine.recordReroute();
          this.logEvent(
            'ROBOT_REROUTING',
            'success',
            `Reroute Successful for ${robot.id}`,
            `New optimal path found (${robot.planned_path.length} steps)`,
            robot.id
          );
        } else {
          robot.status = 'WAITING';
        }
      }
    }

    // 5. Multi-Agent Conflict Detection & Resolution
    if (this.mode === 'DISTRIBUTED') {
      this.performDistributedCoordination();
    }

    // 6. Deadlock Detection & Resolution
    this.performDeadlockCheck();

    // 7. Execute Autonomous Edge Movement Steps
    const robotsObj: Record<string, EdgeRobotAgent> = {};
    for (const [id, agent] of this.robots.entries()) {
      robotsObj[id] = agent;
    }

    for (const robot of this.robots.values()) {
      const prevWait = robot.waiting_time;
      const prevDist = robot.distance_travelled;
      const prevCompleted = robot.completed_tasks;

      robot.stepDecision(
        this.tick,
        this.mode,
        robotsObj,
        this.warehouse.chargingStations,
        this.congestionGrid
      );

      // Record metrics deltas
      if (robot.waiting_time > prevWait) {
        this.metricsEngine.totalWaitingTime += robot.waiting_time - prevWait;
      }
      if (robot.distance_travelled > prevDist) {
        this.metricsEngine.totalDistanceTravelled += robot.distance_travelled - prevDist;
      }
      if (robot.completed_tasks > prevCompleted) {
        // Find completed task
        const completedTask = this.taskAllocator.completeTask(
          robot.current_task?.id || '',
          this.tick
        );
        if (completedTask) {
          this.metricsEngine.recordTaskCompletion(completedTask, this.tick);
          this.logEvent(
            'TASK_COMPLETED',
            'success',
            `Task Completed: ${completedTask.id}`,
            `Delivered to ${completedTask.deliveryName} by ${robot.id}`,
            robot.id,
            completedTask.delivery
          );
        }
      }
    }

    // 8. Collision Safety Verification (Check if any two robots occupy same cell)
    this.verifyNoCollisions();

    // 9. Periodic task refill to ensure continuous multi-agent activity
    this.replenishTasksIfLow();

    // 10. Broadcast State
    this.broadcastState();
  }

  private performDistributedCoordination(): void {
    const activeRobots = Array.from(this.robots.values()).filter(
      (r) => !r.failed && r.status !== 'IDLE'
    );

    for (let i = 0; i < activeRobots.length; i++) {
      for (let j = i + 1; j < activeRobots.length; j++) {
        const r1 = activeRobots[i];
        const r2 = activeRobots[j];

        // Skip if either has communication lost (fallback handles locally)
        if (
          r1.communication_status === 'DISCONNECTED' ||
          r2.communication_status === 'DISCONNECTED'
        ) {
          continue;
        }

        const conflict = this.conflictEngine.detectPairConflict(
          r1.toState(),
          r2.toState(),
          this.tick,
          this.warehouse.intersections
        );

        if (conflict) {
          this.metricsEngine.recordPredictedConflict();
          this.logEvent(
            'CONFLICT_DETECTED',
            'warning',
            `Conflict Predicted: [${conflict.type}]`,
            `${conflict.robot_a} and ${conflict.robot_b} conflict at (${conflict.location[0]}, ${conflict.location[1]})`,
            conflict.robot_a,
            conflict.location
          );

          // Resolve conflict using deterministic priority
          const resolution = this.conflictEngine.resolveConflict(
            conflict,
            r1.toState(),
            r2.toState()
          );

          this.metricsEngine.recordResolvedConflict();

          const winner = this.robots.get(resolution.winnerId);
          const yielder = this.robots.get(resolution.yieldId);

          if (winner && yielder) {
            this.logEvent(
              'CONFLICT_RESOLVED',
              'success',
              `Conflict Resolved`,
              `${resolution.reason} -> ${yielder.id} will ${resolution.action}`,
              yielder.id,
              conflict.location
            );

            if (resolution.action === 'WAIT') {
              yielder.status = 'WAITING';
            } else if (resolution.action === 'REROUTE') {
              yielder.status = 'REROUTING';
              const rerouted = yielder.replanPath(this.congestionGrid);
              if (rerouted) {
                this.metricsEngine.recordReroute();
              } else {
                yielder.status = 'WAITING';
              }
            }
          }
        }
      }
    }
  }

  private performDeadlockCheck(): void {
    const robotsList = Array.from(this.robots.values()).map((r) => r.toState());
    const wfg = this.deadlockDetector.buildWaitForGraph(
      robotsList,
      this.warehouse.intersections
    );
    const cycles = this.deadlockDetector.detectCycles(wfg);

    if (cycles.length > 0) {
      for (const cycle of cycles) {
        this.metricsEngine.recordDeadlock();
        const robotsObj: Record<string, RobotState> = {};
        for (const r of robotsList) {
          robotsObj[r.id] = r;
        }

        const resolvedEvent = this.deadlockDetector.resolveDeadlock(
          cycle,
          robotsObj,
          this.tick
        );

        this.metricsEngine.recordDeadlockResolved();
        this.logEvent(
          'DEADLOCK_DETECTED',
          'alert',
          `Deadlock Cycle Detected`,
          resolvedEvent.reason
        );

        // Force reroute the selected deadlock recovery robot
        const targetRobot = this.robots.get(resolvedEvent.rerouted_robot);
        if (targetRobot) {
          targetRobot.status = 'REROUTING';
          const rerouted = targetRobot.replanPath(this.congestionGrid);
          if (rerouted) {
            this.metricsEngine.recordReroute();
            this.logEvent(
              'DEADLOCK_RESOLVED',
              'success',
              `Deadlock Resolved`,
              `${targetRobot.id} rerouted around contested deadlock bottleneck. Cycle eliminated.`
            );
          }
        }
      }
    }
  }

  private verifyNoCollisions(): void {
    const posMap: Map<string, string> = new Map();
    for (const r of this.robots.values()) {
      if (r.failed) continue;
      const key = `${r.position[0]},${r.position[1]}`;
      if (posMap.has(key)) {
        const otherId = posMap.get(key)!;
        this.metricsEngine.recordCollision();
        this.logEvent(
          'CONFLICT_DETECTED',
          'alert',
          `Collision Detected!`,
          `Robots ${r.id} and ${otherId} collided at cell (${r.position[0]}, ${r.position[1]})`,
          r.id,
          r.position
        );
      } else {
        posMap.set(key, r.id);
      }
    }
  }

  private replenishTasksIfLow(): void {
    const pendingCount = this.taskAllocator.taskQueue.filter((t) => t.status === 'PENDING').length;
    if (pendingCount < 3) {
      const pickups = this.warehouse.pickupStations;
      const deliveries = this.warehouse.deliveryStations;
      const pIdx = Math.floor(Math.random() * pickups.length);
      const dIdx = Math.floor(Math.random() * deliveries.length);
      const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const prio = priorities[Math.floor(Math.random() * priorities.length)];

      this.taskAllocator.createTask(
        pickups[pIdx].position,
        deliveries[dIdx].position,
        pickups[pIdx].name,
        deliveries[dIdx].name,
        prio,
        this.tick
      );
    }
  }

  private updateCongestionGrid(): void {
    // Reset congestion grid
    for (let x = 0; x < this.warehouse.width; x++) {
      for (let y = 0; y < this.warehouse.height; y++) {
        this.congestionGrid[x][y] = 0;
      }
    }

    // Accumulate planned path intersections
    for (const r of this.robots.values()) {
      if (r.failed || r.status === 'IDLE') continue;
      // Mark current position
      const [rx, ry] = r.position;
      if (rx >= 0 && rx < this.warehouse.width && ry >= 0 && ry < this.warehouse.height) {
        this.congestionGrid[rx][ry] = Math.min(1.0, this.congestionGrid[rx][ry] + 0.3);
      }
      // Mark upcoming waypoints along planned path
      for (let i = r.current_path_index; i < Math.min(r.current_path_index + 8, r.planned_path.length); i++) {
        const [px, py] = r.planned_path[i];
        if (px >= 0 && px < this.warehouse.width && py >= 0 && py < this.warehouse.height) {
          this.congestionGrid[px][py] = Math.min(1.0, this.congestionGrid[px][py] + 0.15);
        }
      }
    }
  }

  // --- Interactive Control Triggers ---

  public toggleBlockAisle(x: number, y: number): boolean {
    const blocked = this.warehouse.toggleAisleBlock(x, y);
    if (blocked) {
      this.logEvent(
        'AISLE_BLOCKED',
        'warning',
        `Aisle Blocked at (${x}, ${y})`,
        `Physical obstacle placed in corridor cell. Triggering fleet reroutes.`,
        undefined,
        [x, y]
      );
    } else {
      this.logEvent(
        'AISLE_UNBLOCKED',
        'info',
        `Aisle Cleared at (${x}, ${y})`,
        `Obstacle removed from corridor cell.`,
        undefined,
        [x, y]
      );
    }
    this.broadcastState();
    return blocked;
  }

  public failRobot(robotId: string): boolean {
    const robot = this.robots.get(robotId);
    if (!robot || robot.failed) return false;

    robot.failed = true;
    robot.status = 'FAILED';
    this.metricsEngine.recordRobotFailure();

    this.logEvent(
      'ROBOT_FAILED',
      'alert',
      `Robot Failure: ${robot.id}`,
      `${robot.name} experienced critical hardware failure and halted at (${robot.position[0]}, ${robot.position[1]})`,
      robot.id,
      robot.position
    );

    // Reclaim unfinished task and reassign
    if (robot.current_task) {
      const task = robot.current_task;
      robot.current_task = null;
      this.taskAllocator.reclaimAndReassign(robot.id, task, this.tick);
      this.metricsEngine.recordTaskReassigned();

      this.logEvent(
        'TASK_REASSIGNED',
        'warning',
        `Task Reassigned: ${task.id}`,
        `Task reclaimed from failed robot ${robot.id} and returned to dispatch queue for immediate reallocation.`
      );
    }

    this.broadcastState();
    return true;
  }

  public recoverRobot(robotId: string): boolean {
    const robot = this.robots.get(robotId);
    if (!robot || !robot.failed) return false;

    robot.failed = false;
    robot.status = 'IDLE';
    robot.battery = 100;

    this.logEvent(
      'ROBOT_RECOVERED',
      'success',
      `Robot Recovered: ${robot.id}`,
      `${robot.name} maintenance completed. System diagnostics nominal. Returned to active fleet.`,
      robot.id,
      robot.position
    );

    this.broadcastState();
    return true;
  }

  public toggleNetworkFailure(robotId: string): boolean {
    const robot = this.robots.get(robotId);
    if (!robot) return false;

    const isConnected = this.network.isAgentConnected(robotId);
    if (isConnected) {
      this.network.setAgentCommunication(robotId, false);
      robot.communication_status = 'DISCONNECTED';
      this.metricsEngine.recordCommFailure();

      this.logEvent(
        'NETWORK_FAILURE',
        'alert',
        `Communication Lost: ${robot.id}`,
        `RF signal lost on ${robot.id}. Edge agent switched to autonomous local fallback mode (last-known peer state).`,
        robot.id,
        robot.position
      );
      this.broadcastState();
      return false; // Now disconnected
    } else {
      this.network.setAgentCommunication(robotId, true);
      robot.communication_status = 'CONNECTED';

      this.logEvent(
        'NETWORK_RESTORED',
        'success',
        `Network Restored: ${robot.id}`,
        `RF link re-established on ${robot.id}. Re-synchronized peer intent and state packets.`,
        robot.id,
        robot.position
      );
      this.broadcastState();
      return true; // Now connected
    }
  }

  public addCustomTask(
    pickup: Position,
    delivery: Position,
    pickupName: string,
    deliveryName: string,
    priority: TaskPriority = 'MEDIUM'
  ): Task {
    const task = this.taskAllocator.createTask(
      pickup,
      delivery,
      pickupName,
      deliveryName,
      priority,
      this.tick
    );
    this.logEvent(
      'TASK_CREATED',
      'info',
      `Custom Task Dispatched: ${task.id}`,
      `Route ${pickupName} -> ${deliveryName} [Priority: ${priority}]`
    );
    this.broadcastState();
    return task;
  }

  public logEvent(
    type: SimulationEvent['type'],
    severity: SimulationEvent['severity'],
    title: string,
    description: string,
    robotId?: string,
    location?: Position
  ): void {
    this.eventCounter++;
    const ev: SimulationEvent = {
      id: `EVT-${this.tick}-${this.eventCounter}-${Date.now()}`,
      tick: this.tick,
      timestamp: Date.now(),
      type,
      severity,
      title,
      description,
      robot_id: robotId,
      location,
    };
    this.events.unshift(ev);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
  }

  public getState(): SimulationState {
    const robotsObj: Record<string, RobotState> = {};
    for (const [id, agent] of this.robots.entries()) {
      robotsObj[id] = agent.toState();
    }

    return {
      tick: this.tick,
      running: this.running,
      speedMultiplier: this.speedMultiplier,
      mode: this.mode,
      warehouse: this.warehouse.toConfig(),
      robots: robotsObj,
      tasks: [...this.taskAllocator.taskQueue, ...this.taskAllocator.completedTasks],
      taskQueue: [...this.taskAllocator.taskQueue],
      activeConflicts: this.conflictEngine.getActiveConflicts(),
      recentEvents: this.events.slice(0, 30),
      peerMessages: this.network.getRecentMessages(25),
      metrics: this.metricsEngine.computeMetrics(this.robots.size),
      congestionGrid: this.congestionGrid,
    };
  }

  public broadcastState(): void {
    const state = this.getState();
    for (const listener of this.stateChangeListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in simulation state listener:', err);
      }
    }
  }
}
