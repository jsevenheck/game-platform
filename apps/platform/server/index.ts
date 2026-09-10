import './env';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { requestLogger } from './logging/requestLogger';
import { createComponentLogger, registerProcessLogging } from './logging/logger';
import { registerPartyHandlers } from './party/partyHandlers';
import { gameRegistry, unregisterGame } from './registry/index';
import { registerHttpRoutes } from './httpRoutes';
import { registerAdminRoutes } from './admin';
import { initializeMetrics, setActiveConnections } from './metrics/collectors';
import { registerMetricsRoutes } from './metrics/httpMetrics';
import {
  checkFixedWindowRateLimit,
  pruneExpiredRateLimitEntries,
  type RateLimitRecord,
} from './observability/rateLimit';
import { getTrustedProxyHops, resolveClientIp } from './observability/clientIp';

const app = express();
const httpServer = createServer(app);
const serverLogger = createComponentLogger('platform-server');

// Trust exactly one reverse-proxy hop (Traefik — see docker-compose.yml) so
// Express's own req.ip resolves to the real client address rather than
// Traefik's. Without this, every request's req.ip is the same value (the
// proxy's), which the admin login/action rate limiters key on — collapsing
// them into one shared bucket any anonymous caller can use to lock out
// every legitimate admin. See observability/clientIp.ts for the same
// calculation applied to the raw Socket.IO connection handler below, which
// has no req.ip of its own.
app.set('trust proxy', getTrustedProxyHops());

registerProcessLogging(serverLogger);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
// Scoped to what the app actually loads: same-origin hashed build assets
// and websocket/fetch traffic, plus Google Fonts (main.css imports Syne +
// JetBrains Mono). No game renders an <img> or loads any other external
// resource — every visual is text/emoji/CSS or canvas drawing (data: URIs).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  next();
});
registerMetricsRoutes(app, serverLogger);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
  // Socket.IO defaults to 1 MB per message. No legitimate payload in this
  // app (the largest is Kritzelagent's drawing stroke — at most 80 points,
  // a few KB JSON-encoded) comes close to that; 64 KB leaves generous
  // headroom while meaningfully bounding an oversized-message flood.
  maxHttpBufferSize: 64 * 1024,
});

initializeMetrics();

// A game that fails to register is unavailable — it must not prevent the
// platform and the other seven games from starting. `getGame()` already
// returns undefined for an unknown id, and the lobby handles that, so an
// unregistered game simply cannot be selected or launched.
for (const [gameId, game] of gameRegistry) {
  const namespacePath = `/g/${gameId}`;
  try {
    game.registerServer(io, namespacePath);
    serverLogger.info(
      {
        gameId,
        gameName: game.definition.name,
        namespacePath,
      },
      'registered game namespace'
    );
  } catch (err) {
    unregisterGame(gameId);
    serverLogger.error(
      { err, gameId, namespacePath },
      'failed to register game namespace — game is unavailable, platform continues'
    );
  }
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
    const ip = resolveClientIp(forwarded, engineSocket.remoteAddress);
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
