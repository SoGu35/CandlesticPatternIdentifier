import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAlpacaProxy } from './alpaca-proxy.js';
import { AlpacaWSBridge } from './alpaca-ws.js';

dotenv.config();

const app = express();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5174';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ALPACA_API_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || '';

if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
  console.warn('WARNING: ALPACA_API_KEY and ALPACA_SECRET_KEY not set. Using mock data.');
}

// REST proxy for historical bars
app.use('/api', createAlpacaProxy(ALPACA_API_KEY, ALPACA_SECRET_KEY));

const server = createServer(app);

// WebSocket server for real-time data relay
const wss = new WebSocketServer({ server, path: '/ws' });

const bridge = new AlpacaWSBridge(ALPACA_API_KEY, ALPACA_SECRET_KEY);

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  bridge.addClient(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    bridge.removeClient(ws);
  });
});

// Start the bridge when we have API keys
if (ALPACA_API_KEY && ALPACA_SECRET_KEY) {
  bridge.connect();
} else {
  console.log('No API keys - starting mock data mode');
  bridge.startMockMode();
}

// In production, serve static frontend files
if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  app.use(express.static(path.resolve(import.meta.dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, '../dist/index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
