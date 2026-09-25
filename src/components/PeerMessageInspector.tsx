/**
 * Peer-to-Peer Message Inspector Component
 * Displays actual wireless JSON intent packets exchanged between AMR edge agents.
 */

import React, { useState } from 'react';
import { RobotMessage } from '../../shared/types.ts';
import { Radio, Send, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

interface PeerMessageInspectorProps {
  messages: RobotMessage[];
}

export const PeerMessageInspector: React.FC<PeerMessageInspectorProps> = ({ messages }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Decentralized P2P Intent Stream</h2>
          <span className="text-xs text-slate-500 font-mono">({messages.length} pkts)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active RF Mesh</span>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs max-h-[320px]">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Awaiting peer broadcast packets...
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isExpanded = expandedId === msg.id;

            return (
              <div
                key={`${msg.id}-${idx}`}
                onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                className="cursor-pointer rounded border border-slate-800/80 bg-slate-950/60 p-2 font-mono text-[11px] hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                    )}
                    <span className="font-bold text-sky-400">{msg.sender_id}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-emerald-400">BROADCAST</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                      {msg.intent}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">Tick #{msg.timestamp_tick}</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Pos: [{msg.position[0]}, {msg.position[1]}]</span>
                  <span>ETA: {msg.eta} ticks</span>
                  <span>Bat: {msg.battery}%</span>
                  <span>Prio: {msg.priority_score}</span>
                </div>

                {isExpanded && (
                  <div className="mt-2 rounded bg-slate-900 p-2 text-[10px] text-slate-300 border border-slate-800 overflow-x-auto">
                    <div className="text-slate-500 mb-1">// Raw Peer-to-Peer Wireless Packet Payload</div>
                    <pre className="font-mono text-emerald-300">
                      {JSON.stringify(
                        {
                          sender_id: msg.sender_id,
                          intent: msg.intent,
                          current_pos: msg.position,
                          target_dest: msg.destination,
                          remaining_waypoints: msg.planned_path.slice(0, 5),
                          estimated_arrival: msg.eta,
                          battery_soc: msg.battery,
                          arbitration_priority: msg.priority_score,
                          active_task_id: msg.current_task_id || 'IDLE',
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
