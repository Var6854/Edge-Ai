/**
 * Edge Robot Agent Model
 * Independent edge agent maintaining local state, peer intent memory, local A* planner,
 * battery management, and autonomous edge decision making.
 */

import {
  CommunicationStatus,
  Position,
  RobotMessage,
  RobotState,
  RobotStatus,
  Station,
  Task,
} from '../../shared/types.ts';
import { NetworkListener, P2PNetwork } from './communication.ts';
import { AStarPlanner } from './pathfinding.ts';
import { Warehouse } from './warehouse.ts';

export class EdgeRobotAgent implements NetworkListener {
  public id: string;
  public name: string;
  public color: string;
  public position: Position;
  public previous_position: Position;
  public destination: Position | null = null;
  public current_task: Task | null = null;
  public planned_path: Position[] = [];
  public current_path_index: number = 0;
  public battery: number = 100;
  public speed: number = 1.0;
  public status: RobotStatus = 'IDLE';
  public priority: number = 10;
  public communication_status: CommunicationStatus = 'CONNECTED';
  public waiting_time: number = 0;
  public distance_travelled: number = 0;
  public completed_tasks: number = 0;
  public failed: boolean = false;
  public last_message_time: number = 0;
  public local_intent: string = 'IDLE';
  public local_conflict_id?: string;

  // Local knowledge of peers received via P2P
  public peerKnowledge: Map<string, RobotMessage> = new Map();

  // Internal dependencies
  private warehouse: Warehouse;
  private planner: AStarPlanner;
  private network: P2PNetwork;
  private messageSeq: number = 0;

  // Charging targets
  public chargingTarget: Station | null = null;

  constructor(
    id: string,
    name: string,
    color: string,
    initialPos: Position,
    warehouse: Warehouse,
    network: P2PNetwork
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.position = [...initialPos];
    this.previous_position = [...initialPos];
    this.warehouse = warehouse;
    this.network = network;
    this.planner = new AStarPlanner(warehouse);

    // Register with peer network
    this.network.registerAgent(this.id, this);
  }

  /**
   * NetworkListener implementation: receives intent packet from a peer.
   * If local communication is disconnected, this is dropped.
   */
  public onMessageReceived(message: RobotMessage): void {
    if (this.communication_status === 'DISCONNECTED') {
      return; // Packet dropped at antenna
    }
    this.peerKnowledge.set(message.sender_id, message);
  }

  /**
   * Broadcasts own future intent to peers over the P2P network.
   */
  public broadcastIntent(currentTick: number): void {
    if (this.failed || this.communication_status === 'DISCONNECTED') {
      return;
    }

    const eta = Math.max(0, this.planned_path.length - 1 - this.current_path_index);
    let intentType: RobotMessage['intent'] = 'CRUISING';
    if (this.status === 'IDLE') intentType = 'IDLE';
    else if (this.status === 'WAITING') intentType = 'YIELDING';
    else if (this.status === 'REROUTING') intentType = 'REROUTING';
    else if (this.status === 'CHARGING') intentType = 'CHARGING';

    this.messageSeq++;
    const msg: RobotMessage = {
      id: `MSG-${this.id}-${currentTick}-${this.messageSeq}`,
      sender_id: this.id,
      timestamp_tick: currentTick,
      position: [...this.position],
      destination: this.destination ? [...this.destination] : null,
      intent: intentType,
      planned_path: this.planned_path.slice(this.current_path_index),
      eta,
      battery: Math.round(this.battery),
      priority_score: this.priority,
      current_task_id: this.current_task?.id,
      status: this.status,
    };

    this.last_message_time = currentTick;
    this.local_intent = intentType;
    this.network.broadcast(msg);
  }

  /**
   * Assigns a new task to this robot agent and initiates local path planning.
   */
  public assignTask(task: Task, currentTick: number): boolean {
    if (this.failed || this.battery < 20) return false;

    this.current_task = task;
    this.destination = [...task.pickup];
    this.status = 'MOVING';
    this.current_path_index = 0;

    // Plan path to pickup station
    this.replanPath();
    this.broadcastIntent(currentTick);
    return true;
  }

  /**
   * Computes an A* path to current destination, avoiding obstacles and optionally
   * applying peer reservations / congestion costs.
   */
  public replanPath(congestionGrid?: number[][]): boolean {
    if (!this.destination) return false;

    // Gather dynamic obstacles (e.g., failed robots)
    const dynamicObstacles = new Set<string>();
    for (const [peerId, peer] of this.peerKnowledge.entries()) {
      if (peer.status === 'FAILED') {
        dynamicObstacles.add(`${peer.position[0]},${peer.position[1]}`);
      }
    }

    const path = this.planner.findPath(
      this.position,
      this.destination,
      dynamicObstacles,
      congestionGrid,
      2.5
    );

    if (path.length > 0) {
      this.planned_path = path;
      this.current_path_index = 0;
      this.status = 'MOVING';
      return true;
    } else {
      // No path available (e.g. boxed in)
      this.status = 'WAITING';
      return false;
    }
  }

  /**
   * Autonomous edge decision step executed on every clock tick.
   */
  public stepDecision(
    currentTick: number,
    mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT',
    otherRobots: Record<string, EdgeRobotAgent>,
    chargingStations: Station[],
    congestionGrid?: number[][]
  ): void {
    if (this.failed) {
      this.status = 'FAILED';
      return;
    }

    // 1. Check Battery Level
    if (this.status === 'CHARGING') {
      this.battery = Math.min(100, this.battery + 2.5); // Charge rate
      if (this.battery >= 98) {
        this.status = 'IDLE';
        this.chargingTarget = null;
        this.destination = null;
        this.planned_path = [];
      }
      return;
    }

    // Low battery auto-divert to charger
    if (this.battery < 20 && !this.chargingTarget) {
      const freeCharger = this.findClosestFreeCharger(chargingStations, otherRobots);
      if (freeCharger) {
        this.chargingTarget = freeCharger;
        this.destination = [...freeCharger.position];
        this.status = 'REROUTING';
        this.replanPath(congestionGrid);
      }
    }

    // 2. State machine handling
    if (this.status === 'PICKING') {
      // Simulate loading/picking pallet (1 tick)
      if (this.current_task) {
        this.destination = [...this.current_task.delivery];
        this.status = 'MOVING';
        this.current_path_index = 0;
        this.replanPath(congestionGrid);
      } else {
        this.status = 'IDLE';
      }
      return;
    }

    if (this.status === 'DELIVERING') {
      // Delivered task successfully!
      if (this.current_task) {
        this.completed_tasks++;
        this.current_task = null;
      }
      this.status = 'IDLE';
      this.destination = null;
      this.planned_path = [];
      return;
    }

    // If IDLE, do nothing
    if (this.status === 'IDLE' || !this.destination) {
      return;
    }

    // 3. Check if path is invalidated by newly blocked cell or obstacle
    if (this.isPlannedPathBlocked()) {
      this.status = 'REROUTING';
      const rerouted = this.replanPath(congestionGrid);
      if (!rerouted) {
        this.status = 'WAITING';
        this.waiting_time++;
        return;
      }
    }

    // 4. Mode-specific conflict logic check
    if (mode === 'BASELINE_STOP_AND_WAIT') {
      // Baseline behavior: Stop and wait if ANY other robot is in adjacent radius
      const nextCell = this.getNextStep();
      let mustWait = false;

      for (const other of Object.values(otherRobots)) {
        if (other.id === this.id || other.failed) continue;
        const dist = Math.abs(nextCell[0] - other.position[0]) + Math.abs(nextCell[1] - other.position[1]);
        if (dist <= 1) {
          // In baseline, lower ID stops and waits blindly
          if (this.id > other.id) {
            mustWait = true;
            break;
          }
        }
      }

      if (mustWait) {
        this.status = 'WAITING';
        this.waiting_time++;
        return;
      }
    }

    // If waiting state was forced by conflict resolution
    if (this.status === 'WAITING') {
      this.waiting_time++;
      return;
    }

    // 5. Proactive Safety Collision Prevention Check:
    // Check if intended next cell is currently occupied by another robot that is not moving away
    const nextCell = this.getNextStep();
    if (nextCell[0] !== this.position[0] || nextCell[1] !== this.position[1]) {
      const isOccupied = Object.values(otherRobots).some(
        (other) =>
          other.id !== this.id &&
          other.position[0] === nextCell[0] &&
          other.position[1] === nextCell[1]
      );
      if (isOccupied) {
        this.status = 'WAITING';
        this.waiting_time++;
        return;
      }
    }

    // 6. Execute Movement to next cell
    this.executeStep(currentTick);
  }

  /**
   * Advances the robot along its path by 1 cell.
   */
  public executeStep(currentTick: number): void {
    if (this.current_path_index + 1 >= this.planned_path.length) {
      // Reached destination!
      const atDest =
        this.position[0] === this.destination![0] &&
        this.position[1] === this.destination![1];

      if (atDest) {
        if (this.chargingTarget) {
          this.status = 'CHARGING';
        } else if (this.current_task && this.status === 'MOVING') {
          // If at pickup
          if (
            this.position[0] === this.current_task.pickup[0] &&
            this.position[1] === this.current_task.pickup[1]
          ) {
            this.status = 'PICKING';
          } else if (
            this.position[0] === this.current_task.delivery[0] &&
            this.position[1] === this.current_task.delivery[1]
          ) {
            this.status = 'DELIVERING';
          }
        } else {
          this.status = 'IDLE';
        }
      }
      return;
    }

    this.current_path_index++;
    this.previous_position = [...this.position];
    this.position = [...this.planned_path[this.current_path_index]];
    this.distance_travelled += 1;
    this.status = 'MOVING';

    // Battery depletion: 0.15% per cell movement
    this.battery = Math.max(0, this.battery - 0.15);

    // Check if reached destination at this step
    if (
      this.position[0] === this.destination![0] &&
      this.position[1] === this.destination![1]
    ) {
      if (this.chargingTarget) {
        this.status = 'CHARGING';
      } else if (this.current_task) {
        if (
          this.position[0] === this.current_task.pickup[0] &&
          this.position[1] === this.current_task.pickup[1]
        ) {
          this.status = 'PICKING';
        } else if (
          this.position[0] === this.current_task.delivery[0] &&
          this.position[1] === this.current_task.delivery[1]
        ) {
          this.status = 'DELIVERING';
        }
      } else {
        this.status = 'IDLE';
      }
    }
  }

  public getNextStep(): Position {
    if (this.planned_path && this.current_path_index + 1 < this.planned_path.length) {
      return this.planned_path[this.current_path_index + 1];
    }
    return this.position;
  }

  public isPlannedPathBlocked(): boolean {
    if (!this.planned_path || this.planned_path.length === 0) return false;
    for (let i = this.current_path_index; i < this.planned_path.length; i++) {
      const [x, y] = this.planned_path[i];
      if (!this.warehouse.isTraversable(x, y)) {
        return true;
      }
    }
    return false;
  }

  private findClosestFreeCharger(
    stations: Station[],
    otherRobots: Record<string, EdgeRobotAgent>
  ): Station | null {
    let closest: Station | null = null;
    let minDist = Infinity;

    for (const station of stations) {
      // Check if another robot is already at this charger
      const occupied = Object.values(otherRobots).some(
        (r) =>
          r.id !== this.id &&
          r.position[0] === station.position[0] &&
          r.position[1] === station.position[1]
      );
      if (occupied) continue;

      const d =
        Math.abs(this.position[0] - station.position[0]) +
        Math.abs(this.position[1] - station.position[1]);
      if (d < minDist) {
        minDist = d;
        closest = station;
      }
    }
    return closest;
  }

  public toState(): RobotState {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      position: [...this.position],
      previous_position: [...this.previous_position],
      destination: this.destination ? [...this.destination] : null,
      current_task: this.current_task ? { ...this.current_task } : null,
      planned_path: this.planned_path.map((p) => [...p]),
      current_path_index: this.current_path_index,
      battery: Math.round(this.battery * 10) / 10,
      speed: this.speed,
      status: this.status,
      priority: this.priority,
      communication_status: this.communication_status,
      waiting_time: this.waiting_time,
      distance_travelled: this.distance_travelled,
      completed_tasks: this.completed_tasks,
      failed: this.failed,
      last_message_time: this.last_message_time,
      local_intent: this.local_intent,
      local_conflict_id: this.local_conflict_id,
    };
  }
}
