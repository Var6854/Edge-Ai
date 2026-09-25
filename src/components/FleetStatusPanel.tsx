/**
 * Fleet Status Cards Panel
 * Shows real-time edge telemetry for all AMRs: battery, state, task, communication,
 * distance, waiting time, and edge controls.
 */

import React from 'react';
import { RobotState } from '../../shared/types.ts';
import {
  Battery,
  BatteryCharging,
  BatteryWarning,
  Navigation,
  Radio,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';

interface FleetStatusPanelProps {
  robots: Record<string, RobotState>;
  selectedRobotId: string | null;
  onSelectRobot: (id: string | null) => void;
  onFailRobot: (id: string) => void;
  onRecoverRobot: (id: string) => void;
  onToggleNetwork: (id: string) => void;
}

export const FleetStatusPanel: React.FC<FleetStatusPanelProps> = ({
  robots,
  selectedRobotId,
  onSelectRobot,
  onFailRobot,
  onRecoverRobot,
  onToggleNetwork,
}) => {
  const robotList = Object.values(robots);

  const getStatusColor = (status: RobotState['status']) => {
    switch (status) {
      case 'MOVING':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
      case 'WAITING':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      case 'REROUTING':
        return 'text-sky-400 bg-sky-950/40 border-sky-800/60';
      case 'PICKING':
      case 'DELIVERING':
        return 'text-indigo-400 bg-indigo-950/40 border-indigo-800/60';
      case 'CHARGING':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60';
      case 'FAILED':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Fleet Units ({robotList.length})</span>
        <span>Click card to inspect planned path</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {robotList.map((robot) => {
          const isSelected = robot.id === selectedRobotId;
          const isCommLost = robot.communication_status === 'DISCONNECTED';

          return (
            <div
              key={robot.id}
              onClick={() => onSelectRobot(isSelected ? null : robot.id)}
              className={`group relative cursor-pointer rounded-lg border p-3 transition-all ${
                isSelected
                  ? 'border-sky-500 bg-slate-900/90 shadow-md shadow-sky-500/10 ring-1 ring-sky-500'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {/* Header: ID, Name, Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: robot.failed ? '#64748b' : robot.color }}
                  >
                    {robot.id}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{robot.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Pos: [{robot.position[0]}, {robot.position[1]}]
                    </div>
                  </div>
                </div>

                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium font-mono uppercase tracking-wider ${getStatusColor(
                    robot.status
                  )}`}
                >
                  {robot.status}
                </span>
              </div>

              {/* Battery Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    {robot.status === 'CHARGING' ? (
                      <BatteryCharging className="h-3.5 w-3.5 text-cyan-400" />
                    ) : robot.battery < 20 ? (
                      <BatteryWarning className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Battery className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    Battery
                  </span>
                  <span
                    className={
                      robot.battery < 20
                        ? 'text-rose-400 font-bold'
                        : robot.battery < 50
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {robot.battery}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      robot.battery < 20
                        ? 'bg-rose-500'
                        : robot.battery < 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${robot.battery}%` }}
                  />
                </div>
              </div>

              {/* Task & Edge Telemetry */}
              <div className="mt-2.5 space-y-1 text-[11px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Task:</span>
                  <span className="truncate font-mono text-slate-300 max-w-[120px]">
                    {robot.current_task ? (
                      <span className="text-sky-300">
                        {robot.current_task.id} ({robot.current_task.priority})
                      </span>
                    ) : (
                      'None (Idle)'
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Network:</span>
                  <span
                    className={`flex items-center gap-1 font-mono ${
                      isCommLost ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isCommLost ? (
                      <>
                        <WifiOff className="h-3 w-3" /> Degraded / Lost
                      </>
                    ) : (
                      <>
                        <Radio className="h-3 w-3" /> P2P Mesh OK
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                  <span>Dist: {robot.distance_travelled}m</span>
                  <span>Wait: {robot.waiting_time}s</span>
                  <span>Done: {robot.completed_tasks}</span>
                </div>
              </div>

              {/* Edge Quick Control Triggers */}
              <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800/80 pt-2 text-[10px]">
                {robot.failed ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRecoverRobot(robot.id);
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-950/60 border border-emerald-700/60 py-1 text-emerald-300 hover:bg-emerald-900/80 transition-colors"
                  >
                    <CheckCircle className="h-3 w-3" /> Recover
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFailRobot(robot.id);
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-rose-950/60 border border-rose-800/60 py-1 text-rose-300 hover:bg-rose-900/80 transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3" /> Fail Unit
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNetwork(robot.id);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 rounded border py-1 transition-colors ${
                    isCommLost
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  {isCommLost ? 'Restore RF' : 'Cut RF'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
