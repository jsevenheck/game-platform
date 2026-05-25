import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createComponentLogger } from './logging/logger';
import { clearAllParties } from './party/partyStore';
import { getRecentLogs } from './logging/logBuffer';

const adminLogger = createComponentLogger('admin-http');

// Simple in-memory rate limiting for admin endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const LOGIN_RATE_LIMIT_MAX = 5;

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

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    loginRateLimitMap.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= LOGIN_RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

function readAdminPasswordHash(): string | null {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return hash && hash.length > 0 ? hash : null;
}

function readAdminUsername(): string | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  return username && username.length > 0 ? username : null;
}

function readJwtSecret(): string | null {
  const secret = process.env.ADMIN_JWT_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function isAdminEnabled(): boolean {
  return !!(readAdminPasswordHash() && readAdminUsername() && readJwtSecret());
}

const JWT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function signAdminJwt(): string {
  const secret = readJwtSecret()!;
  return jwt.sign({ role: 'admin' }, secret, { expiresIn: '1h' });
}

function verifyAdminJwt(token: string): boolean {
  const secret = readJwtSecret();
  if (!secret) return false;
  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

function getAdminTokenFromCookie(req: Request): string | undefined {
  const raw = req.cookies?.admin_session;
  return typeof raw === 'string' ? raw : undefined;
}

function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminEnabled()) {
    res.status(503).json({
      ok: false,
      error:
        'Admin API is disabled: ADMIN_USERNAME, ADMIN_PASSWORD_HASH and ADMIN_JWT_SECRET must be configured',
    });
    return;
  }

  const ip = req.ip ?? 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ ok: false, error: 'Too many requests' });
    return;
  }

  const token = getAdminTokenFromCookie(req);
  if (!token || !verifyAdminJwt(token)) {
    adminLogger.warn({ ip, path: req.path }, 'admin authentication failed');
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  next();
}

function setAdminCookie(res: Response, token: string): void {
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: JWT_MAX_AGE_MS,
    path: '/api/admin',
  });
}

function clearAdminCookie(res: Response): void {
  res.clearCookie('admin_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
  });
}

export function registerAdminRoutes(app: Express, io?: Server): void {
  app.post('/api/admin/login', (req, res) => {
    if (!isAdminEnabled()) {
      res.status(503).json({
        ok: false,
        error:
          'Admin API is disabled: ADMIN_USERNAME, ADMIN_PASSWORD_HASH and ADMIN_JWT_SECRET must be configured',
      });
      return;
    }

    const ip = req.ip ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      res.status(429).json({ ok: false, error: 'Too many login attempts' });
      return;
    }

    const { username, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length === 0 ||
      password.length === 0
    ) {
      res.status(400).json({ ok: false, error: 'Username and password are required' });
      return;
    }

    const expectedUsername = readAdminUsername()!;
    const hash = readAdminPasswordHash()!;
    const usernameOk = username === expectedUsername;
    const passwordOk = bcrypt.compareSync(password, hash);
    if (!usernameOk || !passwordOk) {
      adminLogger.warn({ ip, username }, 'admin login failed');
      res.status(401).json({ ok: false, error: 'Invalid credentials' });
      return;
    }

    const token = signAdminJwt();
    setAdminCookie(res, token);
    adminLogger.info({ ip, username }, 'admin logged in');
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    if (!isAdminEnabled()) {
      res.status(503).json({ ok: false, error: 'Admin API is disabled' });
      return;
    }

    const token = getAdminTokenFromCookie(req);
    if (!token || !verifyAdminJwt(token)) {
      res.status(401).json({ ok: false, authenticated: false });
      return;
    }

    res.json({ ok: true, authenticated: true });
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearAdminCookie(res);
    res.json({ ok: true });
  });

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

    // Future: stream logs from structured log backend (e.g. Loki, Datadog, CloudWatch)
    // instead of the in-memory ring buffer when available.
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
