/**
 * A* Pathfinding Algorithm with Manhattan Heuristic, Obstacle Avoidance,
 * and Dynamic Congestion Cost Weighting.
 */

import { Position } from '../../shared/types.ts';
import { Warehouse } from './warehouse.ts';

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // total estimated cost
  parent: AStarNode | null;
  tick?: number; // time step for time-space planning
}

export class AStarPlanner {
  public warehouse: Warehouse;

  constructor(warehouse: Warehouse) {
    this.warehouse = warehouse;
  }

  public manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }

  /**
   * Plans a spatial path from start to destination using A*.
   * @param start [x, y]
   * @param destination [x, y]
   * @param dynamicObstacles Optional set of "x,y" strings to avoid (e.g., failed robots)
   * @param congestionGrid Optional 2D array of congestion cost weights [x][y] (0 to 1)
   * @param congestionWeight Weight factor applied to congestion cost (default 3.0)
   */
  public findPath(
    start: Position,
    destination: Position,
    dynamicObstacles?: Set<string>,
    congestionGrid?: number[][],
    congestionWeight: number = 3.0
  ): Position[] {
    const [startX, startY] = start;
    const [destX, destY] = destination;

    if (startX === destX && startY === destY) {
      return [[startX, startY]];
    }

    // If destination itself is untraversable, return empty
    if (!this.warehouse.isTraversable(destX, destY)) {
      return [];
    }

    const openSet: Map<string, AStarNode> = new Map();
    const closedSet: Set<string> = new Set();

    const startNode: AStarNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.manhattanDistance(start, destination),
      f: this.manhattanDistance(start, destination),
      parent: null,
    };

    const startKey = `${startX},${startY}`;
    openSet.set(startKey, startNode);

    while (openSet.size > 0) {
      // Find node with lowest f-score
      let current: AStarNode | null = null;
      let lowestF = Infinity;

      for (const node of openSet.values()) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
        } else if (node.f === lowestF && (current === null || node.h < current.h)) {
          // Tie-break by lower heuristic
          current = node;
        }
      }

      if (!current) break;
      const currentKey = `${current.x},${current.y}`;

      // Goal reached
      if (current.x === destX && current.y === destY) {
        return this.reconstructPath(current);
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Explore 4-way orthogonal neighbors
      const neighbors: [number, number][] = [
        [current.x + 1, current.y],
        [current.x - 1, current.y],
        [current.x, current.y + 1],
        [current.x, current.y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        const neighborKey = `${nx},${ny}`;

        if (closedSet.has(neighborKey)) continue;

        // Check if cell is traversable
        if (!this.warehouse.isTraversable(nx, ny)) continue;

        // Check dynamic obstacles (unless it is start cell)
        if (dynamicObstacles && dynamicObstacles.has(neighborKey)) {
          // If the dynamic obstacle is the destination, we can't enter
          continue;
        }

        // Calculate step cost: base cost 1 + congestion penalty
        let stepCost = 1.0;
        if (congestionGrid && congestionGrid[nx] && congestionGrid[nx][ny] !== undefined) {
          stepCost += congestionGrid[nx][ny] * congestionWeight;
        }

        const tentativeG = current.g + stepCost;

        const existingOpen = openSet.get(neighborKey);
        if (!existingOpen) {
          const h = this.manhattanDistance([nx, ny], destination);
          const neighborNode: AStarNode = {
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          };
          openSet.set(neighborKey, neighborNode);
        } else if (tentativeG < existingOpen.g) {
          existingOpen.g = tentativeG;
          existingOpen.f = tentativeG + existingOpen.h;
          existingOpen.parent = current;
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Time-space A* pathfinding.
   * Avoids reservations in the format: "x,y,tick"
   * Allows waiting in place (cost = 1).
   */
  public findTimeSpacePath(
    start: Position,
    destination: Position,
    startTick: number,
    reservations: Set<string>,
    maxHorizon: number = 80,
    dynamicObstacles?: Set<string>
  ): Position[] {
    const [startX, startY] = start;
    const [destX, destY] = destination;

    if (startX === destX && startY === destY) {
      return [[startX, startY]];
    }

    if (!this.warehouse.isTraversable(destX, destY)) {
      return [];
    }

    // Priority queue represented via Map for simplicity
    const openSet: Map<string, AStarNode> = new Map();
    const closedSet: Set<string> = new Set();

    const startNode: AStarNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.manhattanDistance(start, destination),
      f: this.manhattanDistance(start, destination),
      parent: null,
      tick: startTick,
    };

    openSet.set(`${startX},${startY},${startTick}`, startNode);

    while (openSet.size > 0) {
      let current: AStarNode | null = null;
      let lowestF = Infinity;

      for (const node of openSet.values()) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
        } else if (node.f === lowestF && (current === null || node.h < current.h)) {
          current = node;
        }
      }

      if (!current) break;
      const currentTick = current.tick ?? startTick;
      const currentKey = `${current.x},${current.y},${currentTick}`;

      if (current.x === destX && current.y === destY) {
        return this.reconstructPath(current);
      }

      if (currentTick - startTick >= maxHorizon) {
        // Horizon limit reached, return best partial or break
        continue;
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Actions: Move 4 directions OR Wait in place
      const nextTick = currentTick + 1;
      const candidateActions: [number, number][] = [
        [current.x, current.y], // Wait action
        [current.x + 1, current.y],
        [current.x - 1, current.y],
        [current.x, current.y + 1],
        [current.x, current.y - 1],
      ];

      for (const [nx, ny] of candidateActions) {
        const nextStateKey = `${nx},${ny},${nextTick}`;

        if (closedSet.has(nextStateKey)) continue;
        if (!this.warehouse.isTraversable(nx, ny)) continue;
        if (dynamicObstacles && dynamicObstacles.has(`${nx},${ny}`)) continue;

        // Check time-space reservation
        if (reservations.has(nextStateKey)) continue;

        // Check vertex swap reservation:
        // if neighbor was occupied by someone moving into current cell
        const swapKey = `${current.x},${current.y}->${nx},${ny}@${nextTick}`;
        if (reservations.has(swapKey)) continue;

        // Cost is 1 for movement, 1.2 for waiting (prefer moving forward)
        const isWait = nx === current.x && ny === current.y;
        const stepCost = isWait ? 1.2 : 1.0;
        const tentativeG = current.g + stepCost;

        const existing = openSet.get(nextStateKey);
        if (!existing) {
          const h = this.manhattanDistance([nx, ny], destination);
          const nextNode: AStarNode = {
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
            tick: nextTick,
          };
          openSet.set(nextStateKey, nextNode);
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
        }
      }
    }

    // Fallback: regular spatial A* if time-space fails
    return this.findPath(start, destination, dynamicObstacles);
  }

  private reconstructPath(endNode: AStarNode): Position[] {
    const path: Position[] = [];
    let curr: AStarNode | null = endNode;
    while (curr) {
      path.unshift([curr.x, curr.y]);
      curr = curr.parent;
    }
    return path;
  }
}
