import { timingSafeEqual } from 'crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'socket.io';
import { createComponentLogger } from './logging/logger';
import { clearAllParties } from './party/partyStore';
import { getRecentLogs } from './logging/logBuffer';

const adminLogger = createComponentLogger('admin-http');

// Simple in-memory rate limiting for admin endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

function readAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

function safeTokenEquals(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = readAdminToken();
  if (!expected) {
    res
      .status(503)
      .json({ ok: false, error: 'Admin API is disabled: ADMIN_TOKEN is not configured' });
    return;
  }

  const ip = req.ip ?? 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ ok: false, error: 'Too many requests' });
    return;
  }

  const authHeader = req.header('authorization')?.trim();
  const supplied = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!supplied || !safeTokenEquals(expected, supplied)) {
    adminLogger.warn({ ip, path: req.path }, 'admin authentication failed');
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  next();
}

export function registerAdminRoutes(app: Express, io?: Server): void {
  app.get('/api/admin/logs', authenticateAdmin, (req, res) => {
    const limitCandidate = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitCandidate)
      ? Math.max(10, Math.min(1000, Math.trunc(limitCandidate)))
      : 200;

    const levelFilter =
      typeof req.query.level === 'string' ? req.query.level.trim().toLowerCase() : undefined;
    const componentFilter =
      typeof req.query.component === 'string' ? req.query.component.trim() : undefined;
    const searchFilter =
      typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : undefined;

    let logs = getRecentLogs(limit);

    if (levelFilter) {
      logs = logs.filter((l) => l.level === levelFilter);
    }
    if (componentFilter) {
      logs = logs.filter((l) => l.component === componentFilter);
    }
    if (searchFilter) {
      logs = logs.filter((l) => l.msg.toLowerCase().includes(searchFilter));
    }

    res.json({ ok: true, logs, total: logs.length });
  });

  app.post('/api/admin/cleanup', authenticateAdmin, (_req, res) => {
    const result = clearAllParties();

    // Force-disconnect every socket so clients cannot stay in a stale state.
    if (io) {
      try {
        io.disconnectSockets(true);
        adminLogger.warn(
          { reason: 'admin_cleanup' },
          'force-disconnected all sockets after cleanup'
        );
      } catch (err) {
        adminLogger.error({ err }, 'failed to disconnect sockets during cleanup');
      }
    }

    adminLogger.warn({ ...result }, 'admin cleanup executed');
    res.json({ ok: true, ...result });
  });
}
