"""
FastAPI Server & Simulation Reference Implementation for Edge-AI AMR Fleet Coordination
Smart India Hackathon 26123
"""

import asyncio
from typing import Dict, List, Optional, Tuple
import math
import heapq
import json

# Position type: (x, y)
Position = Tuple[int, int]

class Warehouse:
    def __init__(self, width: int = 30, height: int = 20):
        self.width = width
        self.height = height
        self.shelves: set[Position] = set()
        self.blocked_aisles: set[Position] = set()
        self.pickup_stations = [
            {"id": "P1", "name": "Pickup Dock A", "pos": (3, 1)},
            {"id": "P2", "name": "Pickup Dock B", "pos": (11, 1)},
            {"id": "P3", "name": "Pickup Dock C", "pos": (19, 1)},
            {"id": "P4", "name": "Pickup Dock D", "pos": (27, 1)},
        ]
        self.delivery_stations = [
            {"id": "D1", "name": "Delivery Station 1", "pos": (3, 18)},
            {"id": "D2", "name": "Delivery Station 2", "pos": (11, 18)},
            {"id": "D3", "name": "Delivery Station 3", "pos": (19, 18)},
            {"id": "D4", "name": "Delivery Station 4", "pos": (27, 18)},
        ]
        self.charging_stations = [
            {"id": "C1", "name": "Charger 1", "pos": (1, 9)},
            {"id": "C2", "name": "Charger 2", "pos": (1, 10)},
            {"id": "C3", "name": "Charger 3", "pos": (28, 9)},
        ]
        self.intersections = [(3, 9), (11, 9), (19, 9), (27, 9)]
        self._init_layout()

    def _init_layout(self):
        racks = [
            (5, 9, 3, 7), (13, 17, 3, 7), (21, 25, 3, 7),
            (5, 9, 11, 15), (13, 17, 11, 15), (21, 25, 11, 15)
        ]
        for x1, x2, y1, y2 in racks:
            for x in range(x1, x2 + 1):
                for y in range(y1, y2 + 1):
                    self.shelves.add((x, y))

    def is_traversable(self, x: int, y: int) -> bool:
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return False
        if (x, y) in self.shelves or (x, y) in self.blocked_aisles:
            return False
        return True


class AStarPlanner:
    def __init__(self, warehouse: Warehouse):
        self.wh = warehouse

    def manhattan(self, a: Position, b: Position) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def find_path(self, start: Position, goal: Position, dynamic_obstacles: Optional[set[Position]] = None) -> List[Position]:
        if start == goal:
            return [start]
        if not self.wh.is_traversable(goal[0], goal[1]):
            return []

        open_set = []
        heapq.heappush(open_set, (self.manhattan(start, goal), 0, start, [start]))
        visited = {}

        while open_set:
            f, g, current, path = heapq.heappop(open_set)

            if current == goal:
                return path

            if current in visited and visited[current] <= g:
                continue
            visited[current] = g

            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nx, ny = current[0] + dx, current[1] + dy
                neighbor = (nx, ny)
                if not self.wh.is_traversable(nx, ny):
                    continue
                if dynamic_obstacles and neighbor in dynamic_obstacles:
                    continue

                tentative_g = g + 1
                if neighbor in visited and visited[neighbor] <= tentative_g:
                    continue

                heapq.heappush(open_set, (tentative_g + self.manhattan(neighbor, goal), tentative_g, neighbor, path + [neighbor]))

        return []
