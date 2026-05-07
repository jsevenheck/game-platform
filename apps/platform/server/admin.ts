import { timingSafeEqual } from 'crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { createComponentLogger } from './logging/logger';
import { clearAllParties } from './party/partyStore';
import { getRecentLogs } from './logging/logBuffer';

const adminLogger = createComponentLogger('admin-http');

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
    res.status(503).json({ ok: false, error: 'Admin API is disabled: ADMIN_TOKEN is not configured' });
    return;
  }

  const authHeader = req.header('authorization')?.trim();
  const supplied = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!supplied || !safeTokenEquals(expected, supplied)) {
    adminLogger.warn({ ip: req.ip, path: req.path }, 'admin authentication failed');
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  next();
}

export function registerAdminRoutes(app: Express): void {
  app.get('/api/admin/logs', authenticateAdmin, (req, res) => {
    const limitCandidate = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitCandidate)
      ? Math.max(10, Math.min(1000, Math.trunc(limitCandidate)))
      : 200;

    res.json({ ok: true, logs: getRecentLogs(limit) });
  });

  app.post('/api/admin/cleanup', authenticateAdmin, (_req, res) => {
    const result = clearAllParties();
    adminLogger.warn({ ...result }, 'admin cleanup executed');
    res.json({ ok: true, ...result });
  });
}
