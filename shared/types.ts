/**
 * Shared Data Models and Types for Edge-AI Distributed AMR Fleet Coordination
 * Smart India Hackathon Problem Statement 26123
 */

export type Position = [number, number]; // [x, y]

export type RobotStatus =
  | 'IDLE'
  | 'MOVING'
  | 'WAITING'
  | 'REROUTING'
  | 'PICKING'
  | 'DELIVERING'
  | 'CHARGING'
  | 'FAILED'
  | 'COMMUNICATION_LOST';

export type CommunicationStatus = 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskStatus = 'PENDING' | 'ASSIGNED' | 'PICKING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface Task {
  id: string;
  pickup: Position;
  delivery: Position;
  pickupName: string;
  deliveryName: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedRobotId?: string;
  createdAtTick: number;
  completedAtTick?: number;
}

export interface TimedWaypoint {
  position: Position;
  tick: number;
}

export type ConflictType =
  | 'SAME_CELL'
  | 'HEAD_ON'
  | 'INTERSECTION'
  | 'FOLLOWING'
  | 'SWAP';

export interface ConflictEvent {
  id: string;
  robot_a: string;
  robot_b: string;
  location: Position;
  time_step: number;
  type: ConflictType;
  resolved: boolean;
  resolution_action?: string;
  winner_robot?: string;
  yielding_robot?: string;
  reason?: string;
  created_at_tick: number;
}

export interface DeadlockEvent {
  id: string;
  cycle: string[]; // robot IDs in the cycle
  resolved: boolean;
  rerouted_robot: string;
  time_step: number;
  reason: string;
}

export interface RobotMessage {
  id: string;
  sender_id: string;
  target_id?: string; // empty means broadcast to all peers
  timestamp_tick: number;
  position: Position;
  destination: Position | null;
  intent: 'IDLE' | 'CRUISING' | 'ENTER_INTERSECTION' | 'YIELDING' | 'REROUTING' | 'CHARGING' | 'EMERGENCY_STOP';
  planned_path: Position[];
  eta: number; // ticks to destination
  battery: number;
  priority_score: number;
  current_task_id?: string;
  status: RobotStatus;
}

export interface RobotState {
  id: string;
  name: string;
  color: string;
  position: Position;
  previous_position: Position;
  destination: Position | null;
  current_task: Task | null;
  planned_path: Position[];
  current_path_index: number;
  battery: number; // 0 - 100
  speed: number; // cells per tick (nominally 1)
  status: RobotStatus;
  priority: number; // dynamic priority score
  communication_status: CommunicationStatus;
  waiting_time: number;
  distance_travelled: number;
  completed_tasks: number;
  failed: boolean;
  last_message_time: number;
  local_intent: string;
  local_conflict_id?: string;
}

export interface Station {
  id: string;
  name: string;
  position: Position;
  type: 'PICKUP' | 'DELIVERY' | 'CHARGING';
  occupiedBy?: string;
}

export interface WarehouseConfig {
  width: number;
  height: number;
  shelves: Position[];
  pickupStations: Station[];
  deliveryStations: Station[];
  chargingStations: Station[];
  blockedCells: Position[];
  intersectionCells: Position[];
}

export interface FleetMetrics {
  current_tick: number;
  total_tasks_completed: number;
  total_tasks_reassigned: number;
  total_collisions: number;
  predicted_conflicts: number;
  resolved_conflicts: number;
  deadlocks_detected: number;
  deadlocks_resolved: number;
  successful_reroutes: number;
  total_distance_travelled: number;
  total_waiting_time: number;
  average_waiting_time: number;
  average_task_completion_time: number;
  robot_failures_count: number;
  communication_failures_count: number;
  mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT';
  baseline_time?: number;
  distributed_time?: number;
  improvement_percentage?: number;
}

export interface SimulationEvent {
  id: string;
  tick: number;
  timestamp: number;
  type:
    | 'TASK_CREATED'
    | 'TASK_ASSIGNED'
    | 'TASK_PICKED'
    | 'TASK_COMPLETED'
    | 'TASK_REASSIGNED'
    | 'CONFLICT_DETECTED'
    | 'CONFLICT_RESOLVED'
    | 'DEADLOCK_DETECTED'
    | 'DEADLOCK_RESOLVED'
    | 'AISLE_BLOCKED'
    | 'AISLE_UNBLOCKED'
    | 'ROBOT_FAILED'
    | 'ROBOT_RECOVERED'
    | 'NETWORK_FAILURE'
    | 'NETWORK_RESTORED'
    | 'ROBOT_REROUTING'
    | 'BATTERY_LOW'
    | 'BENCHMARK_COMPLETE';
  severity: 'info' | 'warning' | 'alert' | 'success';
  title: string;
  description: string;
  robot_id?: string;
  location?: Position;
}

export interface SimulationState {
  tick: number;
  running: boolean;
  speedMultiplier: number;
  mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT';
  warehouse: WarehouseConfig;
  robots: Record<string, RobotState>;
  tasks: Task[];
  taskQueue: Task[];
  activeConflicts: ConflictEvent[];
  recentEvents: SimulationEvent[];
  peerMessages: RobotMessage[];
  metrics: FleetMetrics;
  congestionGrid: number[][]; // 0 to 1 congestion factor per cell
}

export interface BenchmarkResult {
  scenario_name: string;
  tasks_count: number;
  robots_count: number;
  baseline: {
    total_ticks: number;
    avg_task_time: number;
    total_waiting_time: number;
    avg_waiting_time: number;
    total_distance: number;
    collisions: number;
    conflicts: number;
    reroutes: number;
  };
  distributed: {
    total_ticks: number;
    avg_task_time: number;
    total_waiting_time: number;
    avg_waiting_time: number;
    total_distance: number;
    collisions: number;
    conflicts: number;
    reroutes: number;
  };
  time_improvement_percentage: number;
  waiting_improvement_percentage: number;
  zero_collisions_achieved: boolean;
}
