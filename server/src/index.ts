import express from 'express';
import http from 'node:http';
import { join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { GameSession } from './session.js';
import { loadQuestions } from './questions.js';
import { handleMessage } from './handlers.js';
import type { ConnectionInfo } from './handlers.js';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const session = new GameSession();
const questions = loadQuestions('week-09.json');
const connections = new Map<WebSocket, ConnectionInfo>();

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/questions', express.static(join(__dirname, '..', '..', 'questions')));

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const roleParam = url.searchParams.get('role');
  const role: ConnectionInfo['role'] = roleParam === 'present' ? 'present' : null;

  connections.set(ws, { role });
  console.log(`[ws] connected   role=${role ?? 'unknown'}  clients=${wss.clients.size}`);

  ws.on('message', (raw) => handleMessage(ws, raw, { session, connections, questions }));

  ws.on('close', () => {
    connections.delete(ws);
    console.log(`[ws] disconnected clients=${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[ws] error`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
