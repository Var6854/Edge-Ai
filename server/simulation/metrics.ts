/**
 * Metrics Calculation Engine for Fleet Performance & Scientific Benchmark Comparison
 */

import { FleetMetrics, Task } from '../../shared/types.ts';

export class MetricsEngine {
  public currentTick: number = 0;
  public totalTasksCompleted: number = 0;
  public totalTasksReassigned: number = 0;
  public totalCollisions: number = 0;
  public predictedConflicts: number = 0;
  public resolvedConflicts: number = 0;
  public deadlocksDetected: number = 0;
  public deadlocksResolved: number = 0;
  public successfulReroutes: number = 0;
  public totalDistanceTravelled: number = 0;
  public totalWaitingTime: number = 0;
  public robotFailuresCount: number = 0;
  public communicationFailuresCount: number = 0;
  public mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT' = 'DISTRIBUTED';

  public baselineTime?: number;
  public distributedTime?: number;

  private taskCompletionTimes: number[] = [];

  public reset(mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT' = 'DISTRIBUTED'): void {
    this.currentTick = 0;
    this.totalTasksCompleted = 0;
    this.totalTasksReassigned = 0;
    this.totalCollisions = 0;
    this.predictedConflicts = 0;
    this.resolvedConflicts = 0;
    this.deadlocksDetected = 0;
    this.deadlocksResolved = 0;
    this.successfulReroutes = 0;
    this.totalDistanceTravelled = 0;
    this.totalWaitingTime = 0;
    this.robotFailuresCount = 0;
    this.communicationFailuresCount = 0;
    this.taskCompletionTimes = [];
    this.mode = mode;
  }

  public recordTaskCompletion(task: Task, completionTick: number): void {
    this.totalTasksCompleted++;
    const duration = Math.max(1, completionTick - task.createdAtTick);
    this.taskCompletionTimes.push(duration);
  }

  public recordCollision(): void {
    this.totalCollisions++;
  }

  public recordPredictedConflict(): void {
    this.predictedConflicts++;
  }

  public recordResolvedConflict(): void {
    this.resolvedConflicts++;
  }

  public recordDeadlock(): void {
    this.deadlocksDetected++;
  }

  public recordDeadlockResolved(): void {
    this.deadlocksResolved++;
  }

  public recordReroute(): void {
    this.successfulReroutes++;
  }

  public recordTaskReassigned(): void {
    this.totalTasksReassigned++;
  }

  public recordRobotFailure(): void {
    this.robotFailuresCount++;
  }

  public recordCommFailure(): void {
    this.communicationFailuresCount++;
  }

  public computeMetrics(robotsCount: number = 5): FleetMetrics {
    const avgTaskTime =
      this.taskCompletionTimes.length > 0
        ? Math.round(
            (this.taskCompletionTimes.reduce((a, b) => a + b, 0) /
              this.taskCompletionTimes.length) *
              10
          ) / 10
        : 0;

    const avgWait =
      robotsCount > 0 ? Math.round((this.totalWaitingTime / robotsCount) * 10) / 10 : 0;

    let improvementPct: number | undefined = undefined;
    if (this.baselineTime && this.baselineTime > 0 && this.distributedTime && this.distributedTime > 0) {
      improvementPct =
        Math.round(
          ((this.baselineTime - this.distributedTime) / this.baselineTime) * 1000
        ) / 10;
    }

    return {
      current_tick: this.currentTick,
      total_tasks_completed: this.totalTasksCompleted,
      total_tasks_reassigned: this.totalTasksReassigned,
      total_collisions: this.totalCollisions,
      predicted_conflicts: this.predictedConflicts,
      resolved_conflicts: this.resolvedConflicts,
      deadlocks_detected: this.deadlocksDetected,
      deadlocks_resolved: this.deadlocksResolved,
      successful_reroutes: this.successfulReroutes,
      total_distance_travelled: this.totalDistanceTravelled,
      total_waiting_time: this.totalWaitingTime,
      average_waiting_time: avgWait,
      average_task_completion_time: avgTaskTime,
      robot_failures_count: this.robotFailuresCount,
      communication_failures_count: this.communicationFailuresCount,
      mode: this.mode,
      baseline_time: this.baselineTime,
      distributed_time: this.distributedTime,
      improvement_percentage: improvementPct,
    };
  }
}
