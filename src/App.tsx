/**
 * Edge-AI AMR Fleet Coordination Dashboard
 * Smart India Hackathon Problem Statement 26123
 * Master React Application with Real-Time WebSockets, Interactive Canvas,
 * Decentralized Coordination Monitoring, and Reproducible Benchmark Engine.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BenchmarkResult,
  Position,
  RobotState,
  SimulationState,
  Task,
  TaskPriority,
} from '../shared/types.ts';
import { WarehouseCanvas } from './components/WarehouseCanvas.tsx';
import { FleetStatusPanel } from './components/FleetStatusPanel.tsx';
import { LiveEventsFeed } from './components/LiveEventsFeed.tsx';
import { PeerMessageInspector } from './components/PeerMessageInspector.tsx';
import { MetricsAndBenchmark } from './components/MetricsAndBenchmark.tsx';
import { ControlToolbar } from './components/ControlToolbar.tsx';
import { AddTaskModal } from './components/AddTaskModal.tsx';
import { BenchmarkModal } from './components/BenchmarkModal.tsx';
import { RobotDetailModal } from './components/RobotDetailModal.tsx';
import {
  Activity,
  Cpu,
  Layers,
  Radio,
  RefreshCw,
  RotateCcw,
  Zap,
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [blockAisleMode, setBlockAisleMode] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showPaths, setShowPaths] = useState<boolean>(true);

  // Modals state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket initialization and automatic reconnection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_UPDATE') {
            setState(msg.data);
          } else if (msg.type === 'BENCHMARK_RESULT') {
            setBenchmarkResult(msg.data);
            setIsBenchmarkRunning(false);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered error, retrying...', err);
        ws.close();
      };
    };

    connect();

    // Fallback: initial REST fetch in case WebSocket upgrade takes a beat
    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => setState(data))
      .catch((err) => console.warn('REST fallback state load:', err));

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Dispatch WebSocket or REST command helper
  const sendCommand = (type: string, payload?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      // REST fallback
      const endpointMap: Record<string, string> = {
        START: '/api/simulation/start',
        PAUSE: '/api/simulation/pause',
        RESET: '/api/simulation/reset',
      };
      if (endpointMap[type]) {
        fetch(endpointMap[type], { method: 'POST' });
      }
    }
  };

  // Action Handlers
  const handleStart = () => sendCommand('START');
  const handlePause = () => sendCommand('PAUSE');
  const handleStep = () => sendCommand('STEP');
  const handleReset = () => sendCommand('RESET');
  const handleSetSpeed = (speed: number) => sendCommand('SET_SPEED', { speed });
  const handleSetMode = (mode: 'DISTRIBUTED' | 'BASELINE_STOP_AND_WAIT') =>
    sendCommand('SET_MODE', { mode });

  const handleCellClick = (x: number, y: number) => {
    if (blockAisleMode) {
      sendCommand('BLOCK_AISLE', { x, y });
    }
  };

  const handleFailRobot = (robotId: string) => {
    sendCommand('FAIL_ROBOT', { robotId });
  };

  const handleRecoverRobot = (robotId: string) => {
    sendCommand('RECOVER_ROBOT', { robotId });
  };

  const handleToggleNetwork = (robotId: string) => {
    sendCommand('NETWORK_FAILURE', { robotId });
  };

  const handleQuickBlockChokepoint = () => {
    // Toggles arterial intersection [11, 9]
    sendCommand('BLOCK_AISLE', { x: 11, y: 9 });
  };

  const handleQuickFailRobot = () => {
    // Fail first active robot
    if (!state) return;
    const active = (Object.values(state.robots) as RobotState[]).find((r) => !r.failed);
    if (active) {
      handleFailRobot(active.id);
    }
  };

  const handleQuickNetworkCut = () => {
    // Toggle network on R2 or first connected
    if (!state) return;
    const r = (Object.values(state.robots) as RobotState[]).find(
      (r) => r.communication_status === 'CONNECTED'
    );
    if (r) {
      handleToggleNetwork(r.id);
    }
  };

  const handleAddTask = (
    pickup: Position,
    delivery: Position,
    pickupName: string,
    deliveryName: string,
    priority: TaskPriority
  ) => {
    sendCommand('ADD_TASK', { pickup, delivery, pickupName, deliveryName, priority });
  };

  const handleRunBenchmark = () => {
    setIsBenchmarkOpen(true);
    setIsBenchmarkRunning(true);
    sendCommand('RUN_BENCHMARK');
  };

  if (!state) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Activity className="h-10 w-10 text-sky-400 animate-spin mb-4" />
        <h2 className="text-base font-semibold text-slate-100">
          Initializing Multi-Agent AMR Simulation Engine...
        </h2>
        <p className="mt-1 text-xs text-slate-400 font-mono">
          Smart India Hackathon 26123 · Establishing Peer Topology on Port 3000
        </p>
      </div>
    );
  }

  const selectedRobot = selectedRobotId ? state.robots[selectedRobotId] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* Top Bar Contract (Wordmark brand, clean status, primary action) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3.5 backdrop-blur">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-md shadow-sky-600/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">
              Edge-AI AMR Fleet Coordination
            </div>
            <div className="text-[11px] text-slate-400">
              SIH 26123 · Distributed Warehouse Robotics
            </div>
          </div>
        </div>

        {/* Zone 2: System Status & Mode Indicator */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{isConnected ? 'Real-Time Sync' : 'Reconnecting...'}</span>
          </div>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span>Tick #{state.tick}</span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span className="text-sky-300 font-semibold uppercase">{state.mode}</span>
        </div>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunBenchmark}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-500 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Benchmark Verification
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1560px] p-4 lg:p-6 space-y-5">
        {/* Master Control Toolbar */}
        <ControlToolbar
          running={state.running}
          speed={state.speedMultiplier}
          mode={state.mode}
          blockAisleMode={blockAisleMode}
          showHeatmap={showHeatmap}
          showPaths={showPaths}
          onStart={handleStart}
          onPause={handlePause}
          onStep={handleStep}
          onReset={handleReset}
          onSetSpeed={handleSetSpeed}
          onSetMode={handleSetMode}
          onToggleBlockAisleMode={() => setBlockAisleMode(!blockAisleMode)}
          onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
          onTogglePaths={() => setShowPaths(!showPaths)}
          onOpenAddTask={() => setIsAddTaskOpen(true)}
          onQuickBlockChokepoint={handleQuickBlockChokepoint}
          onQuickFailRobot={handleQuickFailRobot}
          onQuickNetworkCut={handleQuickNetworkCut}
        />

        {/* Fleet Status Cards Row */}
        <FleetStatusPanel
          robots={state.robots}
          selectedRobotId={selectedRobotId}
          onSelectRobot={setSelectedRobotId}
          onFailRobot={handleFailRobot}
          onRecoverRobot={handleRecoverRobot}
          onToggleNetwork={handleToggleNetwork}
        />

        {/* Central Warehouse Visualization + Quick Task Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Warehouse Interactive Canvas (3 cols) */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                Live 2D Warehouse Spatial Map (30 × 20 Grid)
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-emerald-500/80 inline-block" /> Inbound Pick
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-blue-500/80 inline-block" /> Outbound Drop
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-amber-500/80 inline-block" /> Charger
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-slate-700 inline-block" /> Storage Rack
                </span>
              </div>
            </div>

            <WarehouseCanvas
              warehouse={state.warehouse}
              robots={state.robots}
              activeConflicts={state.activeConflicts}
              congestionGrid={state.congestionGrid}
              showHeatmap={showHeatmap}
              showPaths={showPaths}
              selectedRobotId={selectedRobotId}
              onSelectRobot={setSelectedRobotId}
              onCellClick={handleCellClick}
              blockAisleMode={blockAisleMode}
            />
          </div>

          {/* Active Tasks Queue Sidebar (1 col) */}
          <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-semibold text-slate-200">Task Dispatch Queue</h3>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {state.taskQueue.length} active
              </span>
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 max-h-[580px] text-xs">
              {state.taskQueue.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Task queue empty. Click &ldquo;Add Task&rdquo; to dispatch.
                </div>
              ) : (
                state.taskQueue.map((t: Task, idx: number) => (
                  <div
                    key={`${t.id}-${idx}`}
                    className="rounded border border-slate-800 bg-slate-950/70 p-2.5 space-y-1 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300">{t.id}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                          t.priority === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      <div>Pick: {t.pickupName} [{t.pickup[0]}, {t.pickup[1]}]</div>
                      <div>Drop: {t.deliveryName} [{t.delivery[0]}, {t.delivery[1]}]</div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900">
                      <span className="text-slate-500">Status: {t.status}</span>
                      {t.assignedRobotId && (
                        <span className="text-sky-400 font-bold">Unit {t.assignedRobotId}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Real-Time KPIs & Scientific Benchmark Comparison */}
        <MetricsAndBenchmark
          metrics={state.metrics}
          onRunBenchmark={handleRunBenchmark}
          isBenchmarkRunning={isBenchmarkRunning}
        />

        {/* Bottom Split: Live Event Feed & Decentralized P2P Message Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LiveEventsFeed events={state.recentEvents} />
          <PeerMessageInspector messages={state.peerMessages} />
        </div>
      </main>

      {/* Modals */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        pickupStations={state.warehouse.pickupStations}
        deliveryStations={state.warehouse.deliveryStations}
        onSubmit={handleAddTask}
      />

      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        result={benchmarkResult}
        onRerun={handleRunBenchmark}
        isRunning={isBenchmarkRunning}
      />

      <RobotDetailModal
        robot={selectedRobot}
        onClose={() => setSelectedRobotId(null)}
        onFail={handleFailRobot}
        onRecover={handleRecoverRobot}
        onToggleNetwork={handleToggleNetwork}
      />
    </div>
  );
}
