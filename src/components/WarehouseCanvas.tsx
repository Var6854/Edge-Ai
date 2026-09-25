/**
 * High-Performance HTML Canvas 2D Warehouse Simulation Renderer
 * Renders 30x20 Grid, Shelves, Aisle Markings, Stations, AMRs with Orientation,
 * Planned Paths, Active Conflict Halos, and Congestion Heatmap.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ConflictEvent, Position, RobotState, WarehouseConfig } from '../../shared/types.ts';

interface WarehouseCanvasProps {
  warehouse: WarehouseConfig;
  robots: Record<string, RobotState>;
  activeConflicts: ConflictEvent[];
  congestionGrid?: number[][];
  showHeatmap: boolean;
  showPaths: boolean;
  selectedRobotId: string | null;
  onSelectRobot: (id: string | null) => void;
  onCellClick: (x: number, y: number) => void;
  blockAisleMode: boolean;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  warehouse,
  robots,
  activeConflicts,
  congestionGrid,
  showHeatmap,
  showPaths,
  selectedRobotId,
  onSelectRobot,
  onCellClick,
  blockAisleMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

  // Cell size in canvas pixels
  const CELL_SIZE = 34;
  const canvasWidth = warehouse.width * CELL_SIZE;
  const canvasHeight = warehouse.height * CELL_SIZE;

  // Shelf set for fast lookup
  const shelfKeys = new Set(warehouse.shelves.map(([x, y]) => `${x},${y}`));
  const blockedKeys = new Set(warehouse.blockedCells.map(([x, y]) => `${x},${y}`));
  const intersectionKeys = new Set(warehouse.intersectionCells.map(([x, y]) => `${x},${y}`));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw Floor Tiles and Grid Lines
    ctx.fillStyle = '#0f172a'; // Deep slate floor
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw subtle grid mesh
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= warehouse.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= warehouse.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(canvasWidth, y * CELL_SIZE);
      ctx.stroke();
    }

    // 2. Draw Intersections / Arterial Choke Points
    for (const [ix, iy] of warehouse.intersectionCells) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(ix * CELL_SIZE, iy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.strokeRect(ix * CELL_SIZE + 2, iy * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }

    // 3. Draw Congestion Heatmap (if enabled)
    if (showHeatmap && congestionGrid) {
      for (let x = 0; x < warehouse.width; x++) {
        for (let y = 0; y < warehouse.height; y++) {
          const val = congestionGrid[x]?.[y] || 0;
          if (val > 0.05 && !shelfKeys.has(`${x},${y}`)) {
            ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.65, val * 0.7)})`;
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // 4. Draw Shelf Racks
    for (const [sx, sy] of warehouse.shelves) {
      const rx = sx * CELL_SIZE;
      const ry = sy * CELL_SIZE;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx + 1, ry + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      // Shelf metal rack horizontal beam lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx + 2, ry + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.fillStyle = '#475569';
      ctx.fillRect(rx + 5, ry + 6, CELL_SIZE - 10, 4);
      ctx.fillRect(rx + 5, ry + CELL_SIZE - 10, CELL_SIZE - 10, 4);
    }

    // 5. Draw Blocked Aisles / Dynamic Obstacles
    for (const [bx, by] of warehouse.blockedCells) {
      const rx = bx * CELL_SIZE;
      const ry = by * CELL_SIZE;

      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(rx + 1, ry + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      // Warning hazard stripes
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 2, ry + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      // Cross pattern
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry + 4);
      ctx.lineTo(rx + CELL_SIZE - 4, ry + CELL_SIZE - 4);
      ctx.moveTo(rx + CELL_SIZE - 4, ry + 4);
      ctx.lineTo(rx + 4, ry + CELL_SIZE - 4);
      ctx.stroke();
    }

    // 6. Draw Stations (Pickup, Delivery, Charging)
    const drawStation = (
      pos: Position,
      label: string,
      sublabel: string,
      bgColor: string,
      borderColor: string,
      textColor: string
    ) => {
      const sx = pos[0] * CELL_SIZE;
      const sy = pos[1] * CELL_SIZE;

      ctx.fillStyle = bgColor;
      ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.fillStyle = textColor;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sx + CELL_SIZE / 2, sy + CELL_SIZE / 2 - 3);

      ctx.font = '7px sans-serif';
      ctx.fillText(sublabel, sx + CELL_SIZE / 2, sy + CELL_SIZE / 2 + 6);
    };

    for (const p of warehouse.pickupStations) {
      drawStation(p.position, p.id, 'INBOUND', 'rgba(16, 185, 129, 0.15)', '#10b981', '#34d399');
    }

    for (const d of warehouse.deliveryStations) {
      drawStation(d.position, d.id, 'OUTBOUND', 'rgba(59, 130, 246, 0.15)', '#3b82f6', '#60a5fa');
    }

    for (const c of warehouse.chargingStations) {
      drawStation(c.position, c.id, 'CHARGE', 'rgba(245, 158, 11, 0.15)', '#f59e0b', '#fbbf24');
    }

    // 7. Draw Planned Paths (if enabled)
    if (showPaths) {
      for (const robot of Object.values(robots)) {
        if (robot.failed || robot.planned_path.length === 0) continue;

        const isSelected = robot.id === selectedRobotId;
        ctx.strokeStyle = robot.color;
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.setLineDash(isSelected ? [] : [4, 4]);

        ctx.beginPath();
        const startX = robot.position[0] * CELL_SIZE + CELL_SIZE / 2;
        const startY = robot.position[1] * CELL_SIZE + CELL_SIZE / 2;
        ctx.moveTo(startX, startY);

        for (let i = robot.current_path_index; i < robot.planned_path.length; i++) {
          const [px, py] = robot.planned_path[i];
          ctx.lineTo(px * CELL_SIZE + CELL_SIZE / 2, py * CELL_SIZE + CELL_SIZE / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
      }
    }

    // 8. Draw Active Conflict Halos
    for (const conflict of activeConflicts) {
      if (!conflict.resolved) {
        const cx = conflict.location[0] * CELL_SIZE + CELL_SIZE / 2;
        const cy = conflict.location[1] * CELL_SIZE + CELL_SIZE / 2;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy, CELL_SIZE * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 9. Draw AMRs (Autonomous Mobile Robots)
    for (const robot of Object.values(robots)) {
      const rx = robot.position[0] * CELL_SIZE + CELL_SIZE / 2;
      const ry = robot.position[1] * CELL_SIZE + CELL_SIZE / 2;
      const isSelected = robot.id === selectedRobotId;

      // Orientation calculation based on previous position
      let angle = 0;
      const dx = robot.position[0] - robot.previous_position[0];
      const dy = robot.position[1] - robot.previous_position[1];
      if (dx > 0) angle = 0;
      else if (dx < 0) angle = Math.PI;
      else if (dy > 0) angle = Math.PI / 2;
      else if (dy < 0) angle = -Math.PI / 2;

      ctx.save();
      ctx.translate(rx, ry);

      // Selected robot halo
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, CELL_SIZE / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Robot Chassis
      ctx.rotate(angle);
      const w = CELL_SIZE * 0.65;
      const h = CELL_SIZE * 0.55;

      // Chassis Body
      ctx.fillStyle = robot.failed ? '#64748b' : robot.color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();

      // Heading indicator / Forward sensor nose
      ctx.fillStyle = robot.failed ? '#94a3b8' : '#ffffff';
      ctx.beginPath();
      ctx.arc(w / 2 - 2, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Drive wheels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-w / 3, -h / 2 - 2, w / 2, 2);
      ctx.fillRect(-w / 3, h / 2, w / 2, 2);

      ctx.restore();

      // Robot ID Badge & State Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(robot.id, rx, ry - 1);

      // Battery level indicator bar below robot
      const barW = CELL_SIZE * 0.7;
      const barH = 3;
      const barX = rx - barW / 2;
      const barY = ry + CELL_SIZE / 2 - 4;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);

      const fillW = Math.max(0, (robot.battery / 100) * barW);
      ctx.fillStyle =
        robot.battery > 50 ? '#10b981' : robot.battery > 25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(barX, barY, fillW, barH);

      // Network lost indicator badge
      if (robot.communication_status === 'DISCONNECTED') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(rx + CELL_SIZE / 2 - 5, ry - CELL_SIZE / 2 + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 6px monospace';
        ctx.fillText('✕', rx + CELL_SIZE / 2 - 5, ry - CELL_SIZE / 2 + 5);
      }
    }

    // 10. Draw Hover cursor
    if (hoveredCell) {
      const hx = hoveredCell[0] * CELL_SIZE;
      const hy = hoveredCell[1] * CELL_SIZE;

      ctx.strokeStyle = blockAisleMode ? '#ef4444' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx, hy, CELL_SIZE, CELL_SIZE);

      if (blockAisleMode) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(hx, hy, CELL_SIZE, CELL_SIZE);
      }
    }
  }, [
    warehouse,
    robots,
    activeConflicts,
    congestionGrid,
    showHeatmap,
    showPaths,
    selectedRobotId,
    hoveredCell,
    blockAisleMode,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);

    if (x >= 0 && x < warehouse.width && y >= 0 && y < warehouse.height) {
      setHoveredCell([x, y]);
    } else {
      setHoveredCell(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);

    if (x >= 0 && x < warehouse.width && y >= 0 && y < warehouse.height) {
      // Check if a robot was clicked
      const clickedRobot = Object.values(robots).find(
        (r) => r.position[0] === x && r.position[1] === y
      );

      if (clickedRobot) {
        onSelectRobot(clickedRobot.id === selectedRobotId ? null : clickedRobot.id);
      } else {
        onCellClick(x, y);
      }
    }
  };

  return (
    <div className="relative overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-inner">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`mx-auto block select-none ${
          blockAisleMode ? 'cursor-crosshair' : 'cursor-pointer'
        }`}
      />

      {/* Coordinate & hover helper HUD */}
      {hoveredCell && (
        <div className="absolute bottom-4 left-4 z-10 rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-xs text-slate-300 backdrop-blur font-mono">
          Cell: [{hoveredCell[0]}, {hoveredCell[1]}]
          {shelfKeys.has(`${hoveredCell[0]},${hoveredCell[1]}`) && (
            <span className="text-amber-400"> · Shelf Rack</span>
          )}
          {blockedKeys.has(`${hoveredCell[0]},${hoveredCell[1]}`) && (
            <span className="text-rose-400"> · Blocked Obstacle</span>
          )}
          {intersectionKeys.has(`${hoveredCell[0]},${hoveredCell[1]}`) && (
            <span className="text-blue-400"> · Choke Intersection</span>
          )}
          {blockAisleMode && (
            <span className="text-rose-400"> · [Click to Toggle Block]</span>
          )}
        </div>
      )}
    </div>
  );
};
