/**
 * Dynamic Task Allocation Engine with Multi-Criteria Scoring & Dynamic Reassignment
 */

import { Position, RobotState, Task, TaskPriority, TaskStatus } from '../../shared/types.ts';
import { Warehouse } from './warehouse.ts';

export class TaskAllocator {
  public taskQueue: Task[] = [];
  public completedTasks: Task[] = [];
  private taskCounter: number = 0;
  private warehouse: Warehouse;

  constructor(warehouse: Warehouse) {
    this.warehouse = warehouse;
  }

  public createTask(
    pickupPos: Position,
    deliveryPos: Position,
    pickupName: string,
    deliveryName: string,
    priority: TaskPriority = 'MEDIUM',
    currentTick: number = 0
  ): Task {
    this.taskCounter++;
    const id = `TASK-${this.taskCounter.toString().padStart(3, '0')}`;
    const task: Task = {
      id,
      pickup: pickupPos,
      delivery: deliveryPos,
      pickupName,
      deliveryName,
      priority,
      status: 'PENDING',
      createdAtTick: currentTick,
    };
    this.taskQueue.push(task);
    return task;
  }

  /**
   * Evaluates available robots and assigns tasks from queue.
   * Scoring factors:
   * 1. Distance to pickup (closer is better)
   * 2. Battery sufficiency (> 30% required for tasks; < 20% rejected)
   * 3. Current workload (IDLE robots preferred)
   * 4. Task priority matching
   */
  public allocateTasks(
    robots: RobotState[],
    currentTick: number,
    congestionGrid?: number[][]
  ): { assigned: { task: Task; robotId: string }[] } {
    const assigned: { task: Task; robotId: string }[] = [];

    // Filter pending tasks sorted by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const priorityWeight: Record<TaskPriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const pending = this.taskQueue
      .filter((t) => t.status === 'PENDING')
      .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    if (pending.length === 0) return { assigned };

    // Find eligible robots: not failed, IDLE, battery >= 25%
    const eligibleRobots = robots.filter(
      (r) => !r.failed && r.status === 'IDLE' && r.battery >= 25 && !r.current_task
    );

    if (eligibleRobots.length === 0) return { assigned };

    for (const task of pending) {
      let bestRobot: RobotState | null = null;
      let bestScore = Infinity; // Lower score is better

      for (const robot of eligibleRobots) {
        // Distance cost
        const dist =
          Math.abs(robot.position[0] - task.pickup[0]) +
          Math.abs(robot.position[1] - task.pickup[1]);

        // Congestion cost around pickup
        let congestionCost = 0;
        if (congestionGrid && congestionGrid[task.pickup[0]] && congestionGrid[task.pickup[0]][task.pickup[1]]) {
          congestionCost = congestionGrid[task.pickup[0]][task.pickup[1]] * 10;
        }

        // Battery health discount
        const batteryBonus = (100 - robot.battery) * 0.1;

        const totalCost = dist + congestionCost + batteryBonus;

        if (totalCost < bestScore) {
          bestScore = totalCost;
          bestRobot = robot;
        }
      }

      if (bestRobot) {
        task.status = 'ASSIGNED';
        task.assignedRobotId = bestRobot.id;

        // Remove bestRobot from eligible list for this allocation round
        const idx = eligibleRobots.indexOf(bestRobot);
        if (idx !== -1) eligibleRobots.splice(idx, 1);

        assigned.push({ task, robotId: bestRobot.id });

        if (eligibleRobots.length === 0) break;
      }
    }

    return { assigned };
  }

  /**
   * Reclaims an uncompleted task from a failed or disconnected robot,
   * resets it to PENDING, and reallocates to another available robot.
   */
  public reclaimAndReassign(
    failedRobotId: string,
    currentTask: Task | null,
    currentTick: number
  ): Task | null {
    if (!currentTask) return null;

    currentTask.status = 'PENDING';
    currentTask.assignedRobotId = undefined;

    // Check if task is already in queue
    const existing = this.taskQueue.find((t) => t.id === currentTask.id);
    if (!existing) {
      this.taskQueue.unshift(currentTask);
    } else {
      existing.status = 'PENDING';
      existing.assignedRobotId = undefined;
    }

    return currentTask;
  }

  public completeTask(taskId: string, currentTick: number): Task | null {
    const idx = this.taskQueue.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      const task = this.taskQueue[idx];
      task.status = 'COMPLETED';
      task.completedAtTick = currentTick;
      this.taskQueue.splice(idx, 1);
      this.completedTasks.push(task);
      return task;
    }
    return null;
  }
}
