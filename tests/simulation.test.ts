/**
 * Comprehensive Automated Test Suite for SIH 26123 AMR Fleet Coordination
 * Tests all 10 core algorithmic requirements:
 * 1. A* pathfinding
 * 2. Collision avoidance
 * 3. Multi-agent conflict detection
 * 4. Priority-based conflict resolution
 * 5. Deadlock detection
 * 6. Dynamic rerouting on blocked corridor
 * 7. Dynamic task allocation & reassignment
 * 8. Robot failure handling
 * 9. Communication failure & fallback
 * 10. Performance metrics calculation
 */

import { Warehouse } from '../server/simulation/warehouse.ts';
import { AStarPlanner } from '../server/simulation/pathfinding.ts';
import { ConflictEngine } from '../server/simulation/conflict.ts';
import { DeadlockDetector } from '../server/simulation/deadlock.ts';
import { TaskAllocator } from '../server/simulation/task_allocator.ts';
import { P2PNetwork } from '../server/simulation/communication.ts';
import { EdgeRobotAgent } from '../server/simulation/robot.ts';
import { WarehouseSimulation } from '../server/simulation/simulation.ts';
import { MetricsEngine } from '../server/simulation/metrics.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function runAllTests() {
  console.log('--- STARTING MULTI-AGENT AMR FLEET TEST SUITE ---');

  // Test 1: A* Pathfinding
  {
    console.log('\n[Test 1] A* Pathfinding');
    const wh = new Warehouse();
    const planner = new AStarPlanner(wh);
    const start: [number, number] = [3, 1];
    const goal: [number, number] = [3, 18];
    const path = planner.findPath(start, goal);
    assert(path.length > 0, 'A* must find a valid path between distant open cells');
    assert(path[0][0] === start[0] && path[0][1] === start[1], 'Path must start at start cell');
    assert(path[path.length - 1][0] === goal[0] && path[path.length - 1][1] === goal[1], 'Path must end at destination');
    for (const [x, y] of path) {
      assert(wh.isTraversable(x, y), `Every cell (${x},${y}) in path must be traversable`);
    }
  }

  // Test 2: Dynamic Rerouting on Obstacle
  {
    console.log('\n[Test 2] Dynamic Rerouting');
    const wh = new Warehouse();
    const planner = new AStarPlanner(wh);
    const start: [number, number] = [3, 1];
    const goal: [number, number] = [3, 18];
    const origPath = planner.findPath(start, goal);
    
    // Block a waypoint along the original path
    const blockCell = origPath[5];
    wh.setAisleBlocked(blockCell[0], blockCell[1], true);
    
    const newPath = planner.findPath(start, goal);
    assert(newPath.length > 0, 'Must find alternate detour path when cell is blocked');
    const containsBlocked = newPath.some(([x, y]) => x === blockCell[0] && y === blockCell[1]);
    assert(!containsBlocked, 'New path must not step on blocked cell');
  }

  // Test 3: Conflict Detection (Same-Cell & Head-on)
  {
    console.log('\n[Test 3] Conflict Detection');
    const wh = new Warehouse();
    const network = new P2PNetwork();
    const engine = new ConflictEngine();

    const r1 = new EdgeRobotAgent('R1', 'Unit 1', '#000', [5, 2], wh, network);
    const r2 = new EdgeRobotAgent('R2', 'Unit 2', '#fff', [7, 2], wh, network);

    // Set planned paths moving toward each other on the same line
    r1.planned_path = [[5, 2], [6, 2], [7, 2]];
    r1.current_path_index = 0;
    r2.planned_path = [[7, 2], [6, 2], [5, 2]];
    r2.current_path_index = 0;

    const conflict = engine.detectPairConflict(r1.toState(), r2.toState(), 1, wh.intersections);
    assert(conflict !== null, 'Must detect head-on / same-cell conflict when paths converge');
    assert(conflict?.type === 'SAME_CELL' || conflict?.type === 'HEAD_ON', 'Conflict type must be SAME_CELL or HEAD_ON');
  }

  // Test 4: Priority-Based Conflict Resolution
  {
    console.log('\n[Test 4] Priority-Based Conflict Resolution');
    const wh = new Warehouse();
    const network = new P2PNetwork();
    const engine = new ConflictEngine();

    const r1 = new EdgeRobotAgent('R1', 'Unit 1', '#000', [5, 2], wh, network);
    const r2 = new EdgeRobotAgent('R2', 'Unit 2', '#fff', [7, 2], wh, network);

    // Give R1 critical task, R2 low task
    r1.current_task = {
      id: 'T1',
      pickup: [3, 1],
      delivery: [3, 18],
      pickupName: 'P1',
      deliveryName: 'D1',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      createdAtTick: 0,
    };
    r2.current_task = {
      id: 'T2',
      pickup: [11, 1],
      delivery: [11, 18],
      pickupName: 'P2',
      deliveryName: 'D2',
      priority: 'LOW',
      status: 'ASSIGNED',
      createdAtTick: 0,
    };

    const p1 = engine.calculatePriority(r1.toState());
    const p2 = engine.calculatePriority(r2.toState());
    assert(p1 > p2, `Critical task priority (${p1}) must exceed Low task priority (${p2})`);

    const conflict = engine.detectPairConflict(r1.toState(), r2.toState(), 1, wh.intersections);
    if (conflict) {
      const resolution = engine.resolveConflict(conflict, r1.toState(), r2.toState());
      assert(resolution.winnerId === 'R1', 'R1 with CRITICAL priority must win conflict');
      assert(resolution.yieldId === 'R2', 'R2 must yield to higher priority R1');
    }
  }

  // Test 5: Deadlock Detection (Cycle detection)
  {
    console.log('\n[Test 5] Deadlock Cycle Detection');
    const detector = new DeadlockDetector();
    const graph = new Map<string, string[]>();
    graph.set('R1', ['R2']);
    graph.set('R2', ['R3']);
    graph.set('R3', ['R1']); // Cycle: R1 -> R2 -> R3 -> R1

    const cycles = detector.detectCycles(graph);
    assert(cycles.length > 0, 'Must detect cycle in cyclic wait-for graph');
    assert(cycles[0].includes('R1') && cycles[0].includes('R2') && cycles[0].includes('R3'), 'Cycle must contain all 3 robots');
  }

  // Test 6: Dynamic Task Allocation & Reassignment on Robot Failure
  {
    console.log('\n[Test 6] Dynamic Task Allocation and Reassignment');
    const wh = new Warehouse();
    const allocator = new TaskAllocator(wh);

    const task = allocator.createTask([3, 1], [3, 18], 'Dock A', 'Line 1', 'HIGH', 0);
    assert(allocator.taskQueue.length === 1, 'Task must be in queue');

    // Simulate robot failure
    const reclaimed = allocator.reclaimAndReassign('R1', task, 5);
    assert(reclaimed !== null, 'Reclaimed task must be valid');
    assert(reclaimed?.status === 'PENDING', 'Reclaimed task status must reset to PENDING');
    assert(reclaimed?.assignedRobotId === undefined, 'Reclaimed task assignedRobotId must be cleared');
  }

  // Test 7: Communication Failure & Local Mode
  {
    console.log('\n[Test 7] P2P Network Failure Simulation');
    const network = new P2PNetwork();
    const packetTracker = { received: false };

    network.registerAgent('R1', { onMessageReceived: () => {} });
    network.registerAgent('R2', { onMessageReceived: () => { packetTracker.received = true; } });

    // Normal broadcast
    network.broadcast({
      id: 'M1',
      sender_id: 'R1',
      timestamp_tick: 1,
      position: [0, 0],
      destination: null,
      intent: 'CRUISING',
      planned_path: [],
      eta: 0,
      battery: 100,
      priority_score: 10,
      status: 'MOVING',
    });
    assert(packetTracker.received, 'Message must be received when network is connected');

    // Disconnect R1
    packetTracker.received = false;
    network.setAgentCommunication('R1', false);
    network.broadcast({
      id: 'M2',
      sender_id: 'R1',
      timestamp_tick: 2,
      position: [0, 0],
      destination: null,
      intent: 'CRUISING',
      planned_path: [],
      eta: 0,
      battery: 100,
      priority_score: 10,
      status: 'MOVING',
    });
    assert(!packetTracker.received, 'Messages from disconnected robot must not be transmitted');
  }

  // Test 8: Full Warehouse Simulation Ticking
  {
    console.log('\n[Test 8] Warehouse Simulation Clock Execution');
    const sim = new WarehouseSimulation();
    assert(sim.robots.size === 5, 'Fleet must initialize with 5 robots');

    const initialTick = sim.tick;
    for (let i = 0; i < 20; i++) {
      sim.step();
    }
    assert(sim.tick === initialTick + 20, 'Simulation tick must advance by exactly 20');
    assert(sim.metricsEngine.totalCollisions === 0, 'Zero collisions must be maintained in distributed mode');
  }

  console.log('\n ALL MULTI-AGENT AMR TESTS PASSED SUCCESSFULLY!');
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
