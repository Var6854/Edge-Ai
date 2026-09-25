/**
 * Robot Edge Agent Inspection Modal
 * Shows in-depth local state, edge decision intent, and peer communication telemetry.
 */

import React from 'react';
import { RobotState } from '../../shared/types.ts';
import {
  X,
  Battery,
  Navigation,
  Radio,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

interface RobotDetailModalProps {
  robot: RobotState | null;
  onClose: () => void;
  onFail: (id: string) => void;
  onRecover: (id: string) => void;
  onToggleNetwork: (id: string) => void;
}

export const RobotDetailModal: React.FC<RobotDetailModalProps> = ({
  robot,
  onClose,
  onFail,
  onRecover,
  onToggleNetwork,
}) => {
  if (!robot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow"
              style={{ backgroundColor: robot.failed ? '#64748b' : robot.color }}
            >
              {robot.id}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{robot.name}</h3>
              <p className="text-xs text-slate-400 font-mono">
                Edge Agent ID: {robot.id} · Priority Score: {robot.priority}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <span className="text-[10px] text-slate-400">Position</span>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                [{robot.position[0]}, {robot.position[1]}]
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <span className="text-[10px] text-slate-400">Battery SoC</span>
              <div className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">
                {robot.battery}%
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <span className="text-[10px] text-slate-400">Operational Status</span>
              <div className="mt-0.5 font-mono text-xs font-semibold uppercase text-sky-400">
                {robot.status}
              </div>
            </div>
          </div>

          {/* Current Task */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span className="text-[11px] font-semibold text-slate-300">Active Task Allocation</span>
            {robot.current_task ? (
              <div className="mt-2 space-y-1 font-mono text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Task ID:</span>
                  <span className="text-sky-300 font-bold">{robot.current_task.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pickup:</span>
                  <span>{robot.current_task.pickupName} [{robot.current_task.pickup[0]}, {robot.current_task.pickup[1]}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery:</span>
                  <span>{robot.current_task.deliveryName} [{robot.current_task.delivery[0]}, {robot.current_task.delivery[1]}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Priority:</span>
                  <span className="text-amber-400">{robot.current_task.priority}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-slate-500">No task currently assigned. Robot is idle or charging.</div>
            )}
          </div>

          {/* Planned Path Waypoints */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-300">
                Planned A* Waypoint Path ({robot.planned_path.length} cells)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Index: {robot.current_path_index}
              </span>
            </div>
            <div className="max-h-24 overflow-y-auto font-mono text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              {robot.planned_path.length > 0 ? (
                robot.planned_path.map((pos, idx) => (
                  <span
                    key={idx}
                    className={`inline-block mr-1.5 ${
                      idx === robot.current_path_index
                        ? 'text-sky-300 font-bold underline'
                        : idx < robot.current_path_index
                        ? 'text-slate-600 line-through'
                        : 'text-slate-400'
                    }`}
                  >
                    ({pos[0]},{pos[1]}){idx < robot.planned_path.length - 1 ? ' →' : ''}
                  </span>
                ))
              ) : (
                <span>No active path planned.</span>
              )}
            </div>
          </div>

          {/* Edge Controls */}
          <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
            {robot.failed ? (
              <button
                onClick={() => onRecover(robot.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Recover Hardware Unit
              </button>
            ) : (
              <button
                onClick={() => onFail(robot.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500 transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Trigger Hardware Failure
              </button>
            )}

            <button
              onClick={() => onToggleNetwork(robot.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {robot.communication_status === 'DISCONNECTED' ? (
                <>
                  <Radio className="h-4 w-4 text-emerald-400" />
                  Restore P2P Network
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-rose-400" />
                  Cut P2P Network
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
