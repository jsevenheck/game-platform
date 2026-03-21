import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { registerPartyHandlers } from './party/partyHandlers';
import { gameRegistry } from './registry/index';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
});

// ─── Register game namespaces ─────────────────────────────────────────────────

for (const [gameId, game] of gameRegistry) {
  const namespacePath = `/g/${gameId}`;
  game.registerServer(io, namespacePath);
  console.log(`[platform] Registered game: ${game.definition.name} on ${namespacePath}`);
}

// ─── Register party namespace ─────────────────────────────────────────────────

registerPartyHandlers(io);
console.log('[platform] Party handlers registered on /party');

// ─── Static files ─────────────────────────────────────────────────────────────

const clientDist = resolve(__dirname, '../dist/client');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  console.log(`[platform] Server running on http://localhost:${PORT}`);
});
