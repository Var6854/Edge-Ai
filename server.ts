/**
 * Server Entry Point for Edge-AI AMR Fleet Coordination
 * Express HTTP + WebSocket Server on Port 3000
 * Mounts Vite middlewares in dev mode, hosts REST API, and broadcasts authoritative multi-agent ticks.
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { BenchmarkRunner } from './server/simulation/benchmark.ts';
import { WarehouseSimulation } from './server/simulation/simulation.ts';
import { TaskPriority } from './shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Initialize authoritative simulation instance
const sim = new WarehouseSimulation();
const benchmarkRunner = new BenchmarkRunner();

// Simulation clock loop (nominally 4 ticks per second at 1x speed = 250ms)
const BASE_TICK_MS = 250;
let simInterval: NodeJS.Timeout | null = null;

function startSimulationLoop(): void {
  if (simInterval) clearInterval(simInterval);

  const intervalMs = Math.max(25, Math.floor(BASE_TICK_MS / sim.speedMultiplier));
  simInterval = setInterval(() => {
    if (sim.running) {
      sim.step();
    }
  }, intervalMs);
}

// Broadcast simulation state to all connected WebSocket clients
sim.addStateChangeListener((state) => {
  const payload = JSON.stringify({ type: 'STATE_UPDATE', data: state });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
      }
    }
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send initial full state immediately
  ws.send(JSON.stringify({ type: 'STATE_UPDATE', data: sim.getState() }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      handleClientCommand(parsed, ws);
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });
});

function handleClientCommand(msg: { type: string; payload?: any }, ws?: WebSocket): void {
  switch (msg.type) {
    case 'START':
      sim.running = true;
      sim.broadcastState();
      break;
    case 'PAUSE':
      sim.running = false;
      sim.broadcastState();
      break;
    case 'STEP':
      sim.running = false;
      sim.step();
      break;
    case 'RESET':
      sim.reset();
      break;
    case 'SET_SPEED':
      if (typeof msg.payload?.speed === 'number') {
        sim.speedMultiplier = Math.max(0.25, Math.min(10, msg.payload.speed));
        startSimulationLoop();
        sim.broadcastState();
      }
      break;
    case 'SET_MODE':
      if (msg.payload?.mode === 'DISTRIBUTED' || msg.payload?.mode === 'BASELINE_STOP_AND_WAIT') {
        sim.setMode(msg.payload.mode);
        sim.broadcastState();
      }
      break;
    case 'BLOCK_AISLE':
      if (typeof msg.payload?.x === 'number' && typeof msg.payload?.y === 'number') {
        sim.toggleBlockAisle(msg.payload.x, msg.payload.y);
      }
      break;
    case 'FAIL_ROBOT':
      if (typeof msg.payload?.robotId === 'string') {
        sim.failRobot(msg.payload.robotId);
      }
      break;
    case 'RECOVER_ROBOT':
      if (typeof msg.payload?.robotId === 'string') {
        sim.recoverRobot(msg.payload.robotId);
      }
      break;
    case 'NETWORK_FAILURE':
      if (typeof msg.payload?.robotId === 'string') {
        sim.toggleNetworkFailure(msg.payload.robotId);
      }
      break;
    case 'ADD_TASK':
      if (msg.payload?.pickup && msg.payload?.delivery) {
        sim.addCustomTask(
          msg.payload.pickup,
          msg.payload.delivery,
          msg.payload.pickupName || 'Pickup Bay',
          msg.payload.deliveryName || 'Delivery Bay',
          (msg.payload.priority as TaskPriority) || 'MEDIUM'
        );
      }
      break;
    case 'RUN_BENCHMARK':
      const result = benchmarkRunner.runBenchmark(200);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'BENCHMARK_RESULT', data: result }));
      }
      break;
    default:
      console.warn('Unknown WebSocket command:', msg.type);
  }
}

// REST API Endpoints
app.get('/api/state', (_req: Request, res: Response) => {
  res.json(sim.getState());
});

app.get('/api/robots', (_req: Request, res: Response) => {
  const robots = Array.from(sim.robots.values()).map((r) => r.toState());
  res.json(robots);
});

app.get('/api/tasks', (_req: Request, res: Response) => {
  res.json({
    queue: sim.taskAllocator.taskQueue,
    completed: sim.taskAllocator.completedTasks,
  });
});

app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json(sim.metricsEngine.computeMetrics(sim.robots.size));
});

app.post('/api/simulation/start', (_req: Request, res: Response) => {
  sim.running = true;
  sim.broadcastState();
  res.json({ success: true, running: true });
});

app.post('/api/simulation/pause', (_req: Request, res: Response) => {
  sim.running = false;
  sim.broadcastState();
  res.json({ success: true, running: false });
});

app.post('/api/simulation/reset', (_req: Request, res: Response) => {
  sim.reset();
  res.json({ success: true, state: sim.getState() });
});

app.post('/api/simulation/speed', (req: Request, res: Response) => {
  const { speed } = req.body;
  if (typeof speed === 'number') {
    sim.speedMultiplier = Math.max(0.25, Math.min(10, speed));
    startSimulationLoop();
    sim.broadcastState();
    res.json({ success: true, speedMultiplier: sim.speedMultiplier });
  } else {
    res.status(400).json({ error: 'Invalid speed value' });
  }
});

app.post('/api/simulation/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === 'DISTRIBUTED' || mode === 'BASELINE_STOP_AND_WAIT') {
    sim.setMode(mode);
    sim.broadcastState();
    res.json({ success: true, mode: sim.mode });
  } else {
    res.status(400).json({ error: 'Invalid mode' });
  }
});

app.post('/api/events/block-aisle', (req: Request, res: Response) => {
  const { x, y } = req.body;
  if (typeof x === 'number' && typeof y === 'number') {
    const isBlocked = sim.toggleBlockAisle(x, y);
    res.json({ success: true, blocked: isBlocked, x, y });
  } else {
    res.status(400).json({ error: 'Invalid x or y coordinates' });
  }
});

app.post('/api/events/fail-robot', (req: Request, res: Response) => {
  const { robotId } = req.body;
  if (typeof robotId === 'string') {
    const success = sim.failRobot(robotId);
    res.json({ success, robotId });
  } else {
    res.status(400).json({ error: 'Invalid robotId' });
  }
});

app.post('/api/events/recover-robot', (req: Request, res: Response) => {
  const { robotId } = req.body;
  if (typeof robotId === 'string') {
    const success = sim.recoverRobot(robotId);
    res.json({ success, robotId });
  } else {
    res.status(400).json({ error: 'Invalid robotId' });
  }
});

app.post('/api/events/network-failure', (req: Request, res: Response) => {
  const { robotId } = req.body;
  if (typeof robotId === 'string') {
    const isConnected = sim.toggleNetworkFailure(robotId);
    res.json({ success: true, robotId, connected: isConnected });
  } else {
    res.status(400).json({ error: 'Invalid robotId' });
  }
});

app.post('/api/tasks', (req: Request, res: Response) => {
  const { pickup, delivery, pickupName, deliveryName, priority } = req.body;
  if (pickup && delivery) {
    const task = sim.addCustomTask(
      pickup,
      delivery,
      pickupName || 'Pickup Bay',
      deliveryName || 'Delivery Bay',
      (priority as TaskPriority) || 'MEDIUM'
    );
    res.json({ success: true, task });
  } else {
    res.status(400).json({ error: 'Missing pickup or delivery coordinates' });
  }
});

app.post('/api/benchmark/run', (_req: Request, res: Response) => {
  const result = benchmarkRunner.runBenchmark(200);
  res.json({ success: true, result });
});

// Configure Vite or Static File Serving
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AMR Fleet Coordination Server running on http://0.0.0.0:${PORT}`);
    startSimulationLoop();
  });
}

setupServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
