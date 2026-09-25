/**
 * Master Simulation Control Toolbar
 * Playback controls, simulation speed, coordination mode toggle, and action triggers.
 */

import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Flame,
  Route,
  Plus,
  Ban,
  Radio,
  AlertTriangle,
  Cpu,
} from 'lucide-react';

interface ControlToolbarProps {
  running: boolean;
  speed: number;
  mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT';
  blockAisleMode: boolean;
  showHeatmap: boolean;
  showPaths: boolean;
  onStart: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
  onSetMode: (mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT') => void;
  onToggleBlockAisleMode: () => void;
  onToggleHeatmap: () => void;
  onTogglePaths: () => void;
  onOpenAddTask: () => void;
  onQuickBlockChokepoint: () => void;
  onQuickFailRobot: () => void;
  onQuickNetworkCut: () => void;
}

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  running,
  speed,
  mode,
  blockAisleMode,
  showHeatmap,
  showPaths,
  onStart,
  onPause,
  onStep,
  onReset,
  onSetSpeed,
  onSetMode,
  onToggleBlockAisleMode,
  onToggleHeatmap,
  onTogglePaths,
  onOpenAddTask,
  onQuickBlockChokepoint,
  onQuickFailRobot,
  onQuickNetworkCut,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 backdrop-blur shadow-sm">
      {/* Group 1: Playback Controls */}
      <div className="flex items-center gap-1.5">
        {running ? (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-500 transition-colors"
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            Pause
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Resume
          </button>
        )}

        <button
          onClick={onStep}
          title="Advance 1 Tick"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Step
        </button>

        <button
          onClick={onReset}
          title="Reset Simulation State"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        {/* Speed Selector */}
        <div className="ml-2 flex items-center gap-0.5 rounded-md bg-slate-950 p-0.5 text-xs font-mono">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`rounded px-2 py-1 transition-colors ${
                speed === s
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Group 2: Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium hidden sm:inline">Coordination Mode:</span>
        <div className="flex items-center rounded-lg bg-slate-950 p-1 text-xs">
          <button
            onClick={() => onSetMode('DISTRIBUTED')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all ${
              mode === 'DISTRIBUTED'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Distributed (Edge-AI)
          </button>
          <button
            onClick={() => onSetMode('BASELINE_STOP_AND_WAIT')}
            className={`rounded-md px-3 py-1 font-medium transition-all ${
              mode === 'BASELINE_STOP_AND_WAIT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stop-and-Wait Baseline
          </button>
        </div>
      </div>

      {/* Group 3: Action Triggers & Visualization Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenAddTask}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </button>

        <button
          onClick={onToggleBlockAisleMode}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            blockAisleMode
              ? 'border-rose-500 bg-rose-950/80 text-rose-300 ring-1 ring-rose-500'
              : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
          {blockAisleMode ? 'Block Active (Click Grid)' : 'Block Aisle'}
        </button>

        <button
          onClick={onQuickBlockChokepoint}
          title="Block an arterial intersection to force immediate dynamic rerouting"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          Block Chokepoint
        </button>

        <button
          onClick={onQuickFailRobot}
          title="Simulate hardware failure on an active robot and watch dynamic task reallocation"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/40 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          Fail Robot
        </button>

        <button
          onClick={onQuickNetworkCut}
          title="Simulate RF signal loss on a robot and watch it switch to autonomous local fallback"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-900/40 transition-colors"
        >
          <Radio className="h-3.5 w-3.5 text-amber-400" />
          RF Cut
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* View toggles */}
        <button
          onClick={onToggleHeatmap}
          title="Toggle Congestion Heatmap"
          className={`rounded-md p-1.5 transition-colors ${
            showHeatmap
              ? 'bg-rose-950 border border-rose-600 text-rose-400'
              : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="h-4 w-4" />
        </button>

        <button
          onClick={onTogglePaths}
          title="Toggle Planned Robot Paths"
          className={`rounded-md p-1.5 transition-colors ${
            showPaths
              ? 'bg-sky-950 border border-sky-600 text-sky-400'
              : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
