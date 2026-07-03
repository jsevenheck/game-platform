import './env';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { requestLogger } from './logging/requestLogger';
import { createComponentLogger, registerProcessLogging } from './logging/logger';
import { registerPartyHandlers } from './party/partyHandlers';
import { gameRegistry } from './registry/index';
import { registerHttpRoutes } from './httpRoutes';
import { registerAdminRoutes } from './admin';
import { initializeMetrics, setActiveConnections } from './metrics/collectors';
import { registerMetricsRoutes } from './metrics/httpMetrics';
import {
  checkFixedWindowRateLimit,
  pruneExpiredRateLimitEntries,
  type RateLimitRecord,
} from './observability/rateLimit';

const app = express();
const httpServer = createServer(app);
const serverLogger = createComponentLogger('platform-server');

registerProcessLogging(serverLogger);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  next();
});
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

const connRateLimit = new Map<string, RateLimitRecord>();
const CONN_RATE_LIMIT_WINDOW_MS = 10_000;
const CONN_RATE_LIMIT_MAX = 20; // max 20 new connections per IP per 10s
const CONN_RATE_LIMIT_ENABLED = process.env.E2E_TESTS !== '1';
const connPruneInterval = setInterval(() => pruneExpiredRateLimitEntries(connRateLimit), 60_000);
connPruneInterval.unref?.();

io.engine.on('connection', (engineSocket) => {
  if (CONN_RATE_LIMIT_ENABLED) {
    const forwarded = engineSocket.request?.headers?.['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
      engineSocket.remoteAddress ||
      'unknown';
    if (
      !checkFixedWindowRateLimit(connRateLimit, ip, {
        windowMs: CONN_RATE_LIMIT_WINDOW_MS,
        max: CONN_RATE_LIMIT_MAX,
      })
    ) {
      serverLogger.warn({ ip }, 'connection rate limit exceeded — dropping socket');
      engineSocket.destroy();
      return;
    }
  }
  setActiveConnections(io.engine.clientsCount);

  engineSocket.on('close', () => {
    setActiveConnections(io.engine.clientsCount);
  });
});

registerPartyHandlers(io);
serverLogger.info({ namespace: '/party' }, 'registered party namespace');

registerAdminRoutes(app, io);
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
