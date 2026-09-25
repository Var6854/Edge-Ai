/**
 * Multi-Agent Conflict Detection and Priority-Based Resolution Engine
 * Handles Same-Cell, Head-On, Intersection, Swap, and Following Conflicts.
 */

import { ConflictEvent, ConflictType, Position, RobotState, TaskPriority } from '../../shared/types.ts';

export class ConflictEngine {
  private activeConflicts: Map<string, ConflictEvent> = new Map();
  private conflictCounter: number = 0;

  public clear(): void {
    this.activeConflicts.clear();
  }

  public getActiveConflicts(): ConflictEvent[] {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Calculates a multi-factor priority score for a robot.
   * Priority considers:
   * 1. Task Urgency (CRITICAL = 40, HIGH = 30, MEDIUM = 20, LOW = 10, IDLE = 0)
   * 2. Waiting Time Factor (longer waiting robots get higher priority to prevent starvation)
   * 3. Battery Urgency (robots with critically low battery need urgent passage to charger)
   * 4. Distance Remaining (closer to dropoff gets slight precedence to finish task)
   * 5. Deterministic tie-breaker based on ID
   */
  public calculatePriority(robot: RobotState): number {
    let score = 0;

    // 1. Task Urgency
    if (robot.current_task) {
      const priorityMap: Record<TaskPriority, number> = {
        CRITICAL: 45,
        HIGH: 35,
        MEDIUM: 25,
        LOW: 15,
      };
      score += priorityMap[robot.current_task.priority] || 15;
    } else if (robot.status === 'CHARGING') {
      score += 5;
    }

    // 2. Waiting Time Factor (Anti-starvation)
    score += Math.min(robot.waiting_time * 2.5, 30);

    // 3. Battery Urgency
    if (robot.battery < 25) {
      score += 20;
    } else if (robot.battery < 15) {
      score += 35;
    }

    // 4. Distance Urgency: if close to destination, expedite completion
    if (robot.destination) {
      const dist = Math.abs(robot.position[0] - robot.destination[0]) + Math.abs(robot.position[1] - robot.destination[1]);
      if (dist <= 3) {
        score += 8;
      }
    }

    // 5. Deterministic tie-breaker
    const idHash = (robot.id.charCodeAt(robot.id.length - 1) % 10) * 0.1;
    score += idHash;

    return Math.round(score * 10) / 10;
  }

  /**
   * Detects spatial and temporal conflicts between a pair of robots.
   */
  public detectPairConflict(
    r1: RobotState,
    r2: RobotState,
    currentTick: number,
    intersections: Position[]
  ): ConflictEvent | null {
    if (r1.id === r2.id) return null;
    if (r1.failed || r2.failed) return null;

    const r1Pos = r1.position;
    const r2Pos = r2.position;

    const r1Next = this.getNextIntendedCell(r1);
    const r2Next = this.getNextIntendedCell(r2);

    // 1. Swap Conflict: R1 wants R2's current cell AND R2 wants R1's current cell
    if (
      this.isSamePos(r1Next, r2Pos) &&
      this.isSamePos(r2Next, r1Pos)
    ) {
      return this.createConflict(
        r1,
        r2,
        r1Next,
        currentTick,
        'SWAP',
        'Head-on Swap deadlock detected: opposing robots targeting each other\'s cell'
      );
    }

    // 2. Same-Cell Conflict: Both want the same cell at the next tick
    if (this.isSamePos(r1Next, r2Next) && !this.isSamePos(r1Pos, r1Next) && !this.isSamePos(r2Pos, r2Next)) {
      return this.createConflict(
        r1,
        r2,
        r1Next,
        currentTick,
        'SAME_CELL',
        'Simultaneous cell contention: both robots projected to enter identical cell'
      );
    }

    // 3. Head-On Conflict: Moving toward each other along an aisle
    const distNow = this.manhattanDist(r1Pos, r2Pos);
    const distNext = this.manhattanDist(r1Next, r2Next);
    if (distNow <= 2 && distNext < distNow) {
      // Check if moving in opposite colinear directions
      const dx1 = r1Next[0] - r1Pos[0];
      const dy1 = r1Next[1] - r1Pos[1];
      const dx2 = r2Next[0] - r2Pos[0];
      const dy2 = r2Next[1] - r2Pos[1];
      if ((dx1 === -dx2 && dx1 !== 0) || (dy1 === -dy2 && dy1 !== 0)) {
        return this.createConflict(
          r1,
          r2,
          r1Next,
          currentTick,
          'HEAD_ON',
          'Head-on approach along narrow corridor'
        );
      }
    }

    // 4. Intersection Conflict: Both entering same arterial intersection within 1 step
    for (const inter of intersections) {
      const d1 = this.manhattanDist(r1Pos, inter);
      const d2 = this.manhattanDist(r2Pos, inter);
      const d1Next = this.manhattanDist(r1Next, inter);
      const d2Next = this.manhattanDist(r2Next, inter);

      if (d1 <= 2 && d2 <= 2 && (d1Next === 0 || d2Next === 0 || (d1Next <= 1 && d2Next <= 1))) {
        return this.createConflict(
          r1,
          r2,
          inter,
          currentTick,
          'INTERSECTION',
          `Concurrent convergence on choke-point intersection at (${inter[0]}, ${inter[1]})`
        );
      }
    }

    // 5. Following Conflict: R1 is right behind R2 moving to R2's spot while R2 is waiting/stopped
    if (this.isSamePos(r1Next, r2Pos) && (r2.status === 'WAITING' || r2.status === 'PICKING' || r2.status === 'DELIVERING')) {
      return this.createConflict(
        r1,
        r2,
        r2Pos,
        currentTick,
        'FOLLOWING',
        'Following buffer violation: trailing robot approaching stationary lead robot'
      );
    }

    return null;
  }

  /**
   * Resolves a detected conflict between two robots using deterministic priority.
   */
  public resolveConflict(conflict: ConflictEvent, r1: RobotState, r2: RobotState): {
    winnerId: string;
    yieldId: string;
    action: 'WAIT' | 'REROUTE';
    reason: string;
  } {
    const p1 = this.calculatePriority(r1);
    const p2 = this.calculatePriority(r2);

    let winner: RobotState;
    let yielder: RobotState;
    let reasonText = '';

    if (p1 >= p2) {
      winner = r1;
      yielder = r2;
      reasonText = `${r1.id} (P:${p1}) prioritized over ${r2.id} (P:${p2}) due to higher task/urgency score`;
    } else {
      winner = r2;
      yielder = r1;
      reasonText = `${r2.id} (P:${p2}) prioritized over ${r1.id} (P:${p1}) due to higher task/urgency score`;
    }

    // Determine yielding action:
    // If it's a head-on or swap conflict, simple waiting won't solve it -> MUST REROUTE
    // If waiting time is already high (> 4 ticks), reroute to avoid deadlock
    const mustReroute =
      conflict.type === 'HEAD_ON' ||
      conflict.type === 'SWAP' ||
      yielder.waiting_time >= 4;

    const action: 'WAIT' | 'REROUTE' = mustReroute ? 'REROUTE' : 'WAIT';

    conflict.resolved = true;
    conflict.winner_robot = winner.id;
    conflict.yielding_robot = yielder.id;
    conflict.resolution_action = action;
    conflict.reason = reasonText;

    return {
      winnerId: winner.id,
      yieldId: yielder.id,
      action,
      reason: reasonText,
    };
  }

  private createConflict(
    r1: RobotState,
    r2: RobotState,
    loc: Position,
    tick: number,
    type: ConflictType,
    desc: string
  ): ConflictEvent {
    this.conflictCounter++;
    const id = `CONF-${this.conflictCounter.toString().padStart(4, '0')}`;
    const conflict: ConflictEvent = {
      id,
      robot_a: r1.id,
      robot_b: r2.id,
      location: loc,
      time_step: tick,
      type,
      resolved: false,
      reason: desc,
      created_at_tick: tick,
    };
    this.activeConflicts.set(id, conflict);
    return conflict;
  }

  public getNextIntendedCell(r: RobotState): Position {
    if (!r.planned_path || r.planned_path.length === 0) {
      return r.position;
    }
    const nextIdx = r.current_path_index + 1;
    if (nextIdx < r.planned_path.length) {
      return r.planned_path[nextIdx];
    }
    return r.position;
  }

  public isSamePos(a: Position, b: Position): boolean {
    return a[0] === b[0] && a[1] === b[1];
  }

  public manhattanDist(a: Position, b: Position): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }
}
