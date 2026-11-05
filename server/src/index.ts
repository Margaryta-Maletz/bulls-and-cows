import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  console.log(`[ws] connected   ip=${ip}  clients=${wss.clients.size}`);

  ws.on('close', () => {
    console.log(`[ws] disconnected ip=${ip}  clients=${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[ws] error ip=${ip}`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
