/**
 * Live Event Feed Component
 * Real-time event log with filtering across conflict, deadlock, reroute, task, and failure events.
 */

import React, { useState } from 'react';
import { SimulationEvent } from '../../shared/types.ts';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Layers,
  RefreshCw,
  Shuffle,
  WifiOff,
} from 'lucide-react';

interface LiveEventsFeedProps {
  events: SimulationEvent[];
}

export const LiveEventsFeed: React.FC<LiveEventsFeedProps> = ({ events }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'CONFLICTS') return ev.type.includes('CONFLICT');
    if (filter === 'DEADLOCKS') return ev.type.includes('DEADLOCK');
    if (filter === 'REROUTES') return ev.type.includes('REROUTING') || ev.type.includes('AISLE');
    if (filter === 'TASKS') return ev.type.includes('TASK');
    if (filter === 'FAILURES') return ev.type.includes('FAILED') || ev.type.includes('NETWORK');
    return true;
  });

  const getEventIcon = (type: SimulationEvent['type'], severity: SimulationEvent['severity']) => {
    if (type.includes('DEADLOCK')) {
      return <Shuffle className="h-4 w-4 text-purple-400" />;
    }
    if (type.includes('CONFLICT')) {
      return severity === 'success' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-400" />
      );
    }
    if (type.includes('REROUTING') || type.includes('AISLE')) {
      return <RefreshCw className="h-4 w-4 text-sky-400" />;
    }
    if (type.includes('NETWORK') || type.includes('FAILED')) {
      return <WifiOff className="h-4 w-4 text-rose-400" />;
    }
    if (type.includes('TASK')) {
      return <Layers className="h-4 w-4 text-blue-400" />;
    }
    return <Info className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur">
      {/* Feed Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-200">Autonomous Edge Event Log</h2>
          <span className="text-xs text-slate-500 font-mono">({filteredEvents.length})</span>
        </div>

        {/* Filter Controls (Allowed functional button tabs) */}
        <div className="flex items-center gap-1 rounded bg-slate-950 p-1 text-[11px]">
          {['ALL', 'CONFLICTS', 'DEADLOCKS', 'REROUTES', 'TASKS', 'FAILURES'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                filter === tab
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 text-xs max-h-[320px]">
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No events logged matching filter &ldquo;{filter}&rdquo;
          </div>
        ) : (
          filteredEvents.map((ev, idx) => (
            <div
              key={`${ev.id}-${idx}`}
              className="flex items-start gap-2.5 rounded border border-slate-800/80 bg-slate-950/40 p-2 transition-colors hover:border-slate-700"
            >
              <div className="mt-0.5 shrink-0">{getEventIcon(ev.type, ev.severity)}</div>

              <div className="flex-1 space-y-0.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-200 truncate">{ev.title}</span>
                  <span className="shrink-0 text-[10px] text-slate-500 font-mono">
                    Tick #{ev.tick}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed break-words">
                  {ev.description}
                </p>
                {ev.location && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Location: [{ev.location[0]}, {ev.location[1]}]
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
