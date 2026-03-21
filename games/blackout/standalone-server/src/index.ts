import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import * as blackoutServer from '../../server/src/socketHandlers';
import { resolveStandaloneStaticDir } from './staticDir';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const registerBlackout =
  (blackoutServer as { registerBlackout?: (ioInstance: Server) => void }).registerBlackout ??
  (blackoutServer as { default?: { registerBlackout?: (ioInstance: Server) => void } }).default
    ?.registerBlackout;

if (!registerBlackout) {
  throw new Error('registerBlackout export not found in server module.');
}

registerBlackout(io);

const { staticDir, preferStandaloneWebDist } = resolveStandaloneStaticDir({
  rootDir: process.cwd(),
  lifecycleEvent: process.env.npm_lifecycle_event ?? '',
  existsSync: fs.existsSync,
});

app.use(express.static(staticDir));
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
    return;
  }
  res.status(404).send('Client build not found. Run "pnpm build" first.');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[standalone-server] Port ${PORT} is already in use.`);
  } else {
    console.error('[standalone-server] Server error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[standalone-server] Blackout server listening on port ${PORT}`);
  console.log('[standalone-server] Game namespace: /g/blackout');
  if (preferStandaloneWebDist) {
    console.log('[standalone-server] Mode: standalone-web preferred');
  }
  console.log(`[standalone-server] Serving static files from: ${staticDir}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[standalone-server] ${signal} received, shutting down...`);
  io.close(() => {
    server.close(() => {
      console.log('[standalone-server] Shutdown complete.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
