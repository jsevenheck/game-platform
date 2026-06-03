import { randomUUID } from 'crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createComponentLogger } from './logging/logger';
import {
  clearAllParties,
  clearMatchTimeout,
  deleteParty,
  getActivePartyMatches,
  getAllParties,
  getParty,
  partyToView,
  schedulePartyCleanup,
  unregisterSocket,
} from './party/partyStore';
import type { PartyMember, PartySession } from './party/types';
import { getRecentLogs } from './logging/logBuffer';
import { gameRegistry, getGame } from './registry/index';

const adminLogger = createComponentLogger('admin-http');

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Simple in-memory rate limiting for admin endpoints
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const loginRateLimitMap = new Map<string, RateLimitRecord>();
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const LOGIN_RATE_LIMIT_MAX = 5;
const RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60_000;

interface AdminPartyMemberView {
  playerId: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

interface AdminPartyView {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  status: PartySession['status'];
  selectedGameId: string | null;
  activeMatch: PartySession['activeMatch'];
  members: AdminPartyMemberView[];
  memberCount: number;
  connectedMemberCount: number;
}

function toAdminPartyView(party: PartySession): AdminPartyView {
  const members = Array.from(party.members.values()).map((member) => ({
    playerId: member.playerId,
    name: member.name,
    connected: member.connected,
    isHost: member.playerId === party.hostPlayerId,
  }));

  return {
    partyId: party.partyId,
    inviteCode: party.inviteCode,
    hostPlayerId: party.hostPlayerId,
    status: party.status,
    selectedGameId: party.selectedGameId,
    activeMatch: party.activeMatch,
    members,
    memberCount: members.length,
    connectedMemberCount: members.filter((member) => member.connected).length,
  };
}

function chooseNextHost(party: PartySession): PartyMember | undefined {
  return (
    Array.from(party.members.values()).find((member) => member.connected) ??
    Array.from(party.members.values())[0]
  );
}

function disconnectActiveMatchSockets(io: Server, party: PartySession): number {
  if (!party.activeMatch) return 0;

  let disconnected = 0;
  const { matchKey, namespace: namespacePath } = party.activeMatch;
  const namespace = io.of(namespacePath);
  for (const socket of namespace.sockets.values()) {
    const socketSessionId = typeof socket.data.sessionId === 'string' ? socket.data.sessionId : '';
    if (socketSessionId === matchKey) {
      socket.disconnect(true);
      disconnected += 1;
    }
  }

  return disconnected;
}

function cleanupActiveMatch(party: PartySession): boolean {
  if (!party.activeMatch) return false;

  const { gameId, matchKey } = party.activeMatch;
  const game = getGame(gameId);
  if (!game) return false;

  game.cleanupMatch(matchKey);
  clearMatchTimeout(party.partyId);
  party.activeMatch = null;
  party.pendingCleanupMatchKey = null;
  party.returnAcks = new Set();
  party.status = 'lobby';
  return true;
}

interface KickPartyMemberResult {
  removed: boolean;
  partyDeleted: boolean;
  disconnectedPartySocket: boolean;
  disconnectedGameSockets: number;
  partyView: AdminPartyView | null;
}

function kickPartyMember(
  io: Server | undefined,
  party: PartySession,
  playerId: string
): KickPartyMemberResult {
  const member = party.members.get(playerId);
  if (!member) {
    return {
      removed: false,
      partyDeleted: false,
      disconnectedPartySocket: false,
      disconnectedGameSockets: 0,
      partyView: toAdminPartyView(party),
    };
  }

  const partySocket =
    io && member.socketId ? io.of('/party').sockets.get(member.socketId) : undefined;
  let disconnectedGameSockets = 0;

  if (member.socketId) {
    unregisterSocket(member.socketId);
  }

  partySocket?.emit('partyKicked', { reason: 'You were removed from the party by an admin.' });
  partySocket?.leave(party.partyId);
  partySocket?.disconnect(true);

  party.members.delete(playerId);
  party.returnAcks.delete(playerId);

  if (party.hostPlayerId === playerId) {
    const nextHost = chooseNextHost(party);
    if (nextHost) {
      party.hostPlayerId = nextHost.playerId;
    }
  }

  if (party.members.size === 0) {
    const partyId = party.partyId;
    try {
      disconnectedGameSockets = io ? disconnectActiveMatchSockets(io, party) : 0;
      cleanupActiveMatch(party);
    } catch (err) {
      adminLogger.warn({ err, partyId }, 'failed to cleanup active match after admin kick');
    }
    clearMatchTimeout(partyId);
    deleteParty(partyId);
    return {
      removed: true,
      partyDeleted: true,
      disconnectedPartySocket: !!partySocket,
      disconnectedGameSockets,
      partyView: null,
    };
  }

  if (party.activeMatch) {
    // Current game modules only expose cleanupMatch(matchKey), not a safe generic
    // mid-match remove-player operation. See docs/known-issues.md for the future
    // removePlayerFromMatch(matchKey, playerId) improvement idea.
    const { gameId, matchKey } = party.activeMatch;
    try {
      disconnectedGameSockets = io ? disconnectActiveMatchSockets(io, party) : 0;
      cleanupActiveMatch(party);
      adminLogger.warn(
        { partyId: party.partyId, gameId, matchKey, reason: 'admin_kick' },
        'admin kick ended active match and returned party to lobby'
      );
    } catch (err) {
      adminLogger.warn(
        { err, partyId: party.partyId, gameId, matchKey },
        'failed to cleanup active match after admin kick'
      );
    }
  }

  const anyConnected = Array.from(party.members.values()).some(
    (currentMember) => currentMember.connected
  );
  if (!anyConnected) {
    schedulePartyCleanup(party.partyId);
  }

  if (io) {
    io.of('/party').to(party.partyId).emit('partyUpdate', partyToView(party));
  }

  return {
    removed: true,
    partyDeleted: false,
    disconnectedPartySocket: !!partySocket,
    disconnectedGameSockets,
    partyView: toAdminPartyView(party),
  };
}

function pruneExpiredRateLimitEntries(map: Map<string, RateLimitRecord>, now = Date.now()): void {
  for (const [ip, record] of map) {
    if (now > record.resetAt) {
      map.delete(ip);
    }
  }
}

const rateLimitPruneInterval = setInterval(() => {
  const now = Date.now();
  pruneExpiredRateLimitEntries(rateLimitMap, now);
  pruneExpiredRateLimitEntries(loginRateLimitMap, now);
}, RATE_LIMIT_PRUNE_INTERVAL_MS);
rateLimitPruneInterval.unref?.();

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

interface AdminJwtPayload extends jwt.JwtPayload {
  role: 'admin';
  csrfToken: string;
}

function isAdminJwtPayload(payload: string | jwt.JwtPayload): payload is AdminJwtPayload {
  return (
    typeof payload !== 'string' &&
    payload.role === 'admin' &&
    typeof payload.csrfToken === 'string' &&
    payload.csrfToken.length > 0
  );
}

function signAdminJwt(csrfToken: string): string {
  const secret = readJwtSecret()!;
  return jwt.sign({ role: 'admin', csrfToken }, secret, { expiresIn: '1h' });
}

function verifyAdminJwt(token: string): AdminJwtPayload | null {
  const secret = readJwtSecret();
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret);
    return isAdminJwtPayload(payload) ? payload : null;
  } catch {
    return null;
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
  const session = token ? verifyAdminJwt(token) : null;
  if (!session) {
    adminLogger.warn({ ip, path: req.path }, 'admin authentication failed');
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  res.locals.adminCsrfToken = session.csrfToken;
  next();
}

function setAdminCookies(res: Response, token: string, csrfToken: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: JWT_MAX_AGE_MS,
    path: '/api/admin',
  });
  res.cookie('admin_csrf', csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    maxAge: JWT_MAX_AGE_MS,
    path: '/api/admin',
  });
}

function clearAdminCookies(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie('admin_session', {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/admin',
  });
  res.clearCookie('admin_csrf', {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/api/admin',
  });
}

function getCsrfTokenFromRequest(req: Request): string | undefined {
  const headerToken = req.get('x-csrf-token') ?? req.get('x-xsrf-token');
  if (headerToken && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  const bodyToken = req.body?.csrfToken;
  return typeof bodyToken === 'string' && bodyToken.trim().length > 0
    ? bodyToken.trim()
    : undefined;
}

function requireAdminCsrf(req: Request, res: Response, next: NextFunction): void {
  const expectedToken =
    typeof res.locals.adminCsrfToken === 'string' ? res.locals.adminCsrfToken : undefined;
  const requestToken = getCsrfTokenFromRequest(req);
  const csrfCookie =
    typeof req.cookies?.admin_csrf === 'string' ? req.cookies.admin_csrf : undefined;

  if (!expectedToken || requestToken !== expectedToken || csrfCookie !== expectedToken) {
    adminLogger.warn({ ip: req.ip ?? 'unknown', path: req.path }, 'admin csrf validation failed');
    res.status(403).json({ ok: false, error: 'CSRF validation failed' });
    return;
  }

  next();
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

    const csrfToken = randomUUID();
    const token = signAdminJwt(csrfToken);
    setAdminCookies(res, token, csrfToken);
    adminLogger.info({ ip, username }, 'admin logged in');
    res.json({ ok: true, csrfToken });
  });

  app.get('/api/admin/me', (req, res) => {
    if (!isAdminEnabled()) {
      res.status(503).json({ ok: false, error: 'Admin API is disabled' });
      return;
    }

    const token = getAdminTokenFromCookie(req);
    const session = token ? verifyAdminJwt(token) : null;
    if (!session) {
      res.status(401).json({ ok: false, authenticated: false });
      return;
    }

    res.json({ ok: true, authenticated: true, csrfToken: session.csrfToken });
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearAdminCookies(res);
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

  app.get('/api/admin/parties', authenticateAdmin, (_req, res) => {
    const parties = getAllParties().map(toAdminPartyView);
    res.json({ ok: true, parties, total: parties.length });
  });

  app.post(
    '/api/admin/parties/:partyId/members/:playerId/kick',
    authenticateAdmin,
    requireAdminCsrf,
    (req, res) => {
      const rawPartyId = req.params.partyId;
      const rawPlayerId = req.params.playerId;
      const partyId = typeof rawPartyId === 'string' ? rawPartyId.trim() : '';
      const playerId = typeof rawPlayerId === 'string' ? rawPlayerId.trim() : '';
      if (!partyId || !playerId) {
        res.status(400).json({ ok: false, error: 'Party and player are required' });
        return;
      }

      const party = getParty(partyId);
      if (!party) {
        res.status(404).json({ ok: false, error: 'Party not found' });
        return;
      }

      const result = kickPartyMember(io, party, playerId);
      if (!result.removed) {
        res.status(404).json({ ok: false, error: 'Player not found' });
        return;
      }

      adminLogger.warn(
        {
          partyId,
          targetPlayerId: playerId,
          partyDeleted: result.partyDeleted,
          disconnectedPartySocket: result.disconnectedPartySocket,
          disconnectedGameSockets: result.disconnectedGameSockets,
        },
        'admin kicked party member'
      );

      res.json({ ok: true, ...result });
    }
  );

  app.post('/api/admin/cleanup', authenticateAdmin, requireAdminCsrf, (_req, res) => {
    const activeMatches = getActivePartyMatches();
    let matchesCleaned = 0;
    let matchCleanupFailures = 0;

    for (const { gameId, matchKey } of activeMatches) {
      const game = getGame(gameId);
      if (!game) {
        matchCleanupFailures += 1;
        adminLogger.warn({ gameId }, 'admin cleanup skipped unknown game match');
        continue;
      }

      try {
        game.cleanupMatch(matchKey);
        matchesCleaned += 1;
      } catch (err) {
        matchCleanupFailures += 1;
        adminLogger.error({ err, gameId }, 'admin cleanup failed to clean game match');
      }
    }

    const result = clearAllParties();

    // Force-disconnect every socket namespace so clients cannot stay in a stale state.
    if (io) {
      try {
        io.of('/party').disconnectSockets(true);
        for (const [gameId] of gameRegistry) {
          io.of(`/g/${gameId}`).disconnectSockets(true);
        }
        adminLogger.warn(
          { reason: 'admin_cleanup', namespaces: gameRegistry.size + 1 },
          'force-disconnected sockets after cleanup'
        );
      } catch (err) {
        adminLogger.error({ err }, 'failed to disconnect sockets during cleanup');
      }
    }

    adminLogger.warn({ ...result, matchesCleaned, matchCleanupFailures }, 'admin cleanup executed');
    res.json({ ok: true, ...result, matchesCleaned, matchCleanupFailures });
  });
}
