"""
Automated Python Test Suite for Smart India Hackathon 26123:
Edge-AI Multi-Agent Fleet Coordination for Autonomous Mobile Robots (AMRs)
Using Python standard library (heapq, math, unittest).
"""

import unittest
import math
import heapq

class TestWarehousePathfindingAndCoordination(unittest.TestCase):
    def setUp(self):
        self.width = 30
        self.height = 20
        self.shelves = set()
        # Shelf rack setup
        racks = [
            (5, 9, 3, 7),
            (13, 17, 3, 7),
            (21, 25, 3, 7),
            (5, 9, 11, 15),
            (13, 17, 11, 15),
            (21, 25, 11, 15),
        ]
        for x1, x2, y1, y2 in racks:
            for x in range(x1, x2 + 1):
                for y in range(y1, y2 + 1):
                    self.shelves.add((x, y))

    def is_traversable(self, x, y, blocked_set=None):
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return False
        if (x, y) in self.shelves:
            return False
        if blocked_set and (x, y) in blocked_set:
            return False
        return True

    def astar(self, start, goal, blocked_set=None):
        if start == goal:
            return [start]
        if not self.is_traversable(goal[0], goal[1], blocked_set):
            return []

        def h(pos):
            return abs(pos[0] - goal[0]) + abs(pos[1] - goal[1])

        open_set = []
        heapq.heappush(open_set, (h(start), 0, start, [start]))
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
                if not self.is_traversable(nx, ny, blocked_set):
                    continue

                tentative_g = g + 1
                if neighbor in visited and visited[neighbor] <= tentative_g:
                    continue

                heapq.heappush(open_set, (tentative_g + h(neighbor), tentative_g, neighbor, path + [neighbor]))

        return []

    def test_astar_path_found(self):
        start = (3, 1)
        goal = (3, 18)
        path = self.astar(start, goal)
        self.assertTrue(len(path) > 0, "A* must find path from (3,1) to (3,18)")
        self.assertEqual(path[0], start)
        self.assertEqual(path[-1], goal)
        for cell in path:
            self.assertTrue(self.is_traversable(cell[0], cell[1]))

    def test_dynamic_reroute_on_blocked_corridor(self):
        start = (3, 1)
        goal = (3, 18)
        orig_path = self.astar(start, goal)
        self.assertTrue(len(orig_path) > 5)

        # Block cell on path
        blocked_cell = orig_path[5]
        blocked_set = {blocked_cell}

        new_path = self.astar(start, goal, blocked_set)
        self.assertTrue(len(new_path) > 0, "Reroute must find detour around blocked cell")
        self.assertNotIn(blocked_cell, new_path, "Detour must not contain blocked cell")

    def test_priority_conflict_resolution(self):
        # Priority formula: task_urgency + waiting_time*2.5 + battery_urgency
        r1_task_priority = 45  # CRITICAL
        r2_task_priority = 15  # LOW
        r1_waiting = 0
        r2_waiting = 2

        score_r1 = r1_task_priority + r1_waiting * 2.5
        score_r2 = r2_task_priority + r2_waiting * 2.5

        self.assertGreater(score_r1, score_r2, "Critical task priority must override low task")

    def test_deadlock_cycle_detection(self):
        # Directed wait-for graph: R1 -> R2 -> R3 -> R1
        wfg = {
            "R1": ["R2"],
            "R2": ["R3"],
            "R3": ["R1"]
        }
        
        visited = set()
        stack = set()
        has_cycle = False

        def dfs(node):
            nonlocal has_cycle
            visited.add(node)
            stack.add(node)
            for neighbor in wfg.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in stack:
                    has_cycle = True
            stack.remove(node)

        for n in wfg:
            if n not in visited:
                dfs(n)

        self.assertTrue(has_cycle, "Must detect cyclic dependency in wait-for graph")


if __name__ == "__main__":
    unittest.main()
