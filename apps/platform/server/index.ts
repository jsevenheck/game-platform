import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { requestLogger } from './logging/requestLogger';
import { createComponentLogger, registerProcessLogging } from './logging/logger';
import { registerPartyHandlers } from './party/partyHandlers';
import { gameRegistry } from './registry/index';
import { registerHttpRoutes } from './httpRoutes';
import { initializeMetrics, setActiveConnections } from './metrics/collectors';
import { registerMetricsRoutes } from './metrics/httpMetrics';

const app = express();
const httpServer = createServer(app);
const serverLogger = createComponentLogger('platform-server');

registerProcessLogging(serverLogger);
app.use(requestLogger);
registerMetricsRoutes(app, serverLogger);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
});

initializeMetrics();

for (const [gameId, game] of gameRegistry) {
  const namespacePath = `/g/${gameId}`;
  game.registerServer(io, namespacePath);
  serverLogger.info(
    {
      gameId,
      gameName: game.definition.name,
      namespacePath,
    },
    'registered game namespace'
  );
}

io.engine.on('connection', (engineSocket) => {
  setActiveConnections(io.engine.clientsCount);

  engineSocket.on('close', () => {
    setActiveConnections(io.engine.clientsCount);
  });
});

registerPartyHandlers(io);
serverLogger.info({ namespace: '/party' }, 'registered party namespace');

registerHttpRoutes(app);

httpServer.on('error', (error) => {
  serverLogger.fatal({ err: error }, 'http server error');
  setImmediate(() => process.exit(1));
});

let shutdownInProgress = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  serverLogger.info({ signal }, 'received shutdown signal');

  const forceExitTimer = setTimeout(() => {
    serverLogger.error({ signal }, 'forced shutdown after timeout');
    serverLogger.flush();
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref?.();

  io.close(() => {
    clearTimeout(forceExitTimer);
    serverLogger.info({ signal }, 'shutdown complete');
    serverLogger.flush();
    process.exit(0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(signal));
}

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  serverLogger.info(
    {
      port: PORT,
      url: `http://localhost:${PORT}`,
    },
    'server listening'
  );
});
