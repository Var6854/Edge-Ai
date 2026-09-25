/**
 * Deadlock Detection & Resolution via Directed Wait-For Graph (WFG) Cycle Analysis
 */

import { DeadlockEvent, Position, RobotState } from '../../shared/types.ts';

export class DeadlockDetector {
  private deadlockCounter: number = 0;

  /**
   * Constructs the Wait-For Graph:
   * Edge A -> B exists if Robot A is waiting to enter a cell currently occupied by Robot B,
   * or if Robot A is blocked by Robot B in an ongoing conflict.
   */
  public buildWaitForGraph(
    robots: RobotState[],
    _intersections: Position[]
  ): Map<string, string[]> {
    const graph: Map<string, string[]> = new Map();
    const posToRobot: Map<string, string> = new Map();

    for (const r of robots) {
      if (r.failed) continue;
      graph.set(r.id, []);
      posToRobot.set(`${r.position[0]},${r.position[1]}`, r.id);
    }

    for (const r of robots) {
      if (r.failed || r.status !== 'WAITING') continue;

      // Find which cell r wants to enter next
      if (r.planned_path && r.current_path_index + 1 < r.planned_path.length) {
        const nextPos = r.planned_path[r.current_path_index + 1];
        const blockingRobotId = posToRobot.get(`${nextPos[0]},${nextPos[1]}`);

        if (blockingRobotId && blockingRobotId !== r.id) {
          const edges = graph.get(r.id) || [];
          if (!edges.includes(blockingRobotId)) {
            edges.push(blockingRobotId);
          }
          graph.set(r.id, edges);
        }
      }
    }

    return graph;
  }

  /**
   * Detects cycles in the directed Wait-For Graph using DFS.
   * Returns list of robot IDs involved in the deadlock cycle.
   */
  public detectCycles(graph: Map<string, string[]>): string[][] {
    const visited: Set<string> = new Set();
    const inStack: Set<string> = new Set();
    const parentMap: Map<string, string> = new Map();
    const cycles: string[][] = [];

    const dfs = (node: string, currentPath: string[]) => {
      visited.add(node);
      inStack.add(node);
      currentPath.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          parentMap.set(neighbor, node);
          dfs(neighbor, currentPath);
        } else if (inStack.has(neighbor)) {
          // Found cycle: trace cycle from neighbor to node
          const cycleStartIndex = currentPath.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            const cycle = currentPath.slice(cycleStartIndex);
            cycles.push([...cycle]);
          }
        }
      }

      currentPath.pop();
      inStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Resolves a deadlock cycle by selecting the optimal robot to force-reroute.
   * Selection strategy: Robot with lowest priority / lowest task urgency or longest wait.
   */
  public resolveDeadlock(
    cycle: string[],
    robotsMap: Record<string, RobotState>,
    currentTick: number
  ): DeadlockEvent {
    this.deadlockCounter++;
    const id = `DLK-${this.deadlockCounter.toString().padStart(4, '0')}`;

    // Select candidate with lowest priority score
    let selectedRobotId = cycle[0];
    let lowestPriority = Infinity;

    for (const rId of cycle) {
      const r = robotsMap[rId];
      if (!r) continue;
      const prio = r.priority;
      if (prio < lowestPriority) {
        lowestPriority = prio;
        selectedRobotId = rId;
      }
    }

    const event: DeadlockEvent = {
      id,
      cycle,
      resolved: true,
      rerouted_robot: selectedRobotId,
      time_step: currentTick,
      reason: `Deadlock cycle [${cycle.join(' -> ')}] broken: forcing reroute on ${selectedRobotId} (priority: ${lowestPriority})`,
    };

    return event;
  }
}
