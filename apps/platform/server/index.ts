import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerPartyHandlers } from './party/partyHandlers';
import { gameRegistry } from './registry/index';
import { registerHttpRoutes } from './httpRoutes';

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

registerHttpRoutes(app);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  console.log(`[platform] Server running on http://localhost:${PORT}`);
});
