/**
 * Add Custom Task Modal Dialog
 * Allows dispatcher to configure pickup dock, delivery bay, and priority level.
 */

import React, { useState } from 'react';
import { Position, Station, TaskPriority } from '../../shared/types.ts';
import { X, Plus, Layers } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickupStations: Station[];
  deliveryStations: Station[];
  onSubmit: (
    pickup: Position,
    delivery: Position,
    pName: string,
    dName: string,
    priority: TaskPriority
  ) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  pickupStations,
  deliveryStations,
  onSubmit,
}) => {
  const [selectedPickup, setSelectedPickup] = useState<string>(pickupStations[0]?.id || 'P1');
  const [selectedDelivery, setSelectedDelivery] = useState<string>(deliveryStations[0]?.id || 'D1');
  const [priority, setPriority] = useState<TaskPriority>('HIGH');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pStation = pickupStations.find((s) => s.id === selectedPickup) || pickupStations[0];
    const dStation = deliveryStations.find((s) => s.id === selectedDelivery) || deliveryStations[0];

    onSubmit(pStation.position, dStation.position, pStation.name, dStation.name, priority);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-sky-400" />
            <h3 className="text-base font-semibold text-slate-100">Dispatch Logistics Task</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Pickup Station (Inbound)
            </label>
            <select
              value={selectedPickup}
              onChange={(e) => setSelectedPickup(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              {pickupStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.name} [{s.position[0]}, {s.position[1]}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Delivery Station (Outbound / Packing)
            </label>
            <select
              value={selectedDelivery}
              onChange={(e) => setSelectedDelivery(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              {deliveryStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.name} [{s.position[0]}, {s.position[1]}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Arbitration Priority
            </label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TaskPriority[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-md border py-2 text-center text-xs font-semibold transition-all ${
                    priority === p
                      ? p === 'CRITICAL'
                        ? 'border-rose-500 bg-rose-950 text-rose-300 ring-1 ring-rose-500'
                        : p === 'HIGH'
                        ? 'border-amber-500 bg-amber-950 text-amber-300 ring-1 ring-amber-500'
                        : 'border-sky-500 bg-sky-950 text-sky-300 ring-1 ring-sky-500'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Higher priority tasks grant AMRs right-of-way during intersection conflict negotiation.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Dispatch Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
