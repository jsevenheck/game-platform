import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'http';
import { request as httpRequest } from 'http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { registerAdminRoutes } from '../server/admin';
import { clearAllParties, createParty, getParty } from '../server/party/partyStore';

const ADMIN_USERNAME = 'root';
const ADMIN_PASSWORD = 'correct-horse-battery';
const JWT_SECRET = 'test-jwt-secret-please-rotate';

interface HttpResponse {
  status: number;
  body: Record<string, unknown>;
  cookies: Record<string, string>;
  setCookieRaw: string[];
}

/**
 * Minimal cookie-aware HTTP client. Mirrors the raw-http style used in
 * serverRoutes.test.ts so we don't pull in supertest just for the admin suite.
 */
function parseSetCookies(setCookie: string[] | undefined): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const entry of setCookie ?? []) {
    const [pair] = entry.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    jar[name] = value;
  }
  return jar;
}

function request(
  baseUrl: string,
  method: string,
  path: string,
  opts: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<HttpResponse> {
  const url = new URL(baseUrl + path);
  const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const cookieHeader = opts.cookies
    ? Object.entries(opts.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    : undefined;

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(opts.headers ?? {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let body: Record<string, unknown>;
          try {
            body = data ? JSON.parse(data) : {};
          } catch {
            body = { _raw: data };
          }
          resolve({
            status: res.statusCode ?? 0,
            body,
            cookies: parseSetCookies(res.headers['set-cookie']),
            setCookieRaw: res.headers['set-cookie'] ?? [],
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(
  baseUrl: string
): Promise<{ session: Record<string, string>; csrfToken: string }> {
  const res = await request(baseUrl, 'POST', '/api/admin/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(res.status).toBe(200);
  return {
    session: { admin_session: res.cookies.admin_session, admin_csrf: res.cookies.admin_csrf },
    csrfToken: res.body.csrfToken as string,
  };
}

describe('admin routes', () => {
  let server: Server;
  let baseUrl: string;
  // Logged in once and shared: the login endpoint is rate-limited to 5/min per IP,
  // so re-authenticating in every test would trip the limiter. The JWT lasts 1h.
  let session: Record<string, string>;
  let csrfToken: string;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = ADMIN_USERNAME;
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    process.env.ADMIN_JWT_SECRET = JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    registerAdminRoutes(app);

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('unexpected address');
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const loggedIn = await login(baseUrl);
    session = loggedIn.session;
    csrfToken = loggedIn.csrfToken;
  });

  afterAll(() => {
    server.close();
    clearAllParties();
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_JWT_SECRET;
  });

  beforeEach(() => {
    clearAllParties();
  });

  describe('authentication', () => {
    it('rejects login with invalid credentials', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/login', {
        body: { username: ADMIN_USERNAME, password: 'wrong' },
      });
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });

    it('rejects login with missing fields', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/login', { body: { username: '' } });
      expect(res.status).toBe(400);
    });

    it('issues an HttpOnly session cookie and a readable csrf cookie on success', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/login', {
        body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.csrfToken).toBeTruthy();

      const sessionCookie = res.setCookieRaw.find((c) => c.startsWith('admin_session='));
      const csrfCookie = res.setCookieRaw.find((c) => c.startsWith('admin_csrf='));
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(csrfCookie).not.toMatch(/HttpOnly/i);
      // csrf cookie value must match the body token (double-submit pattern)
      expect(res.cookies.admin_csrf).toBe(res.body.csrfToken);
    });

    it('reports authenticated state via /me', async () => {
      const res = await request(baseUrl, 'GET', '/api/admin/me', { cookies: session });
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
    });

    it('reports unauthenticated via /me without a cookie', async () => {
      const res = await request(baseUrl, 'GET', '/api/admin/me');
      expect(res.status).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });
  });

  describe('protected endpoints', () => {
    it('rejects /parties without a session cookie', async () => {
      const res = await request(baseUrl, 'GET', '/api/admin/parties');
      expect(res.status).toBe(401);
    });

    it('rejects a forged/garbage session token', async () => {
      const res = await request(baseUrl, 'GET', '/api/admin/parties', {
        cookies: { admin_session: 'not.a.real.jwt' },
      });
      expect(res.status).toBe(401);
    });

    it('returns parties with a valid session cookie', async () => {
      createParty('host-1', 'Alice', 'socket-1');
      const res = await request(baseUrl, 'GET', '/api/admin/parties', { cookies: session });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      const parties = res.body.parties as Array<Record<string, unknown>>;
      expect(parties[0].hostPlayerId).toBe('host-1');
    });
  });

  describe('CSRF protection', () => {
    it('rejects a state-changing request without a CSRF token', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/cleanup', { cookies: session });
      expect(res.status).toBe(403);
    });

    it('rejects a CSRF token that does not match the cookie', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/cleanup', {
        cookies: session,
        headers: { 'x-csrf-token': 'mismatched-token' },
      });
      expect(res.status).toBe(403);
    });

    it('accepts a state-changing request with a matching CSRF token', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/cleanup', {
        cookies: session,
        headers: { 'x-csrf-token': csrfToken },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('member kick', () => {
    it('returns 404 for an unknown party', async () => {
      const res = await request(baseUrl, 'POST', '/api/admin/parties/nope/members/x/kick', {
        cookies: session,
        headers: { 'x-csrf-token': csrfToken },
      });
      expect(res.status).toBe(404);
    });

    it('removes a member from a multi-member party', async () => {
      const { party } = createParty('host-1', 'Alice', 'socket-1');
      party.members.set('guest-1', {
        playerId: 'guest-1',
        name: 'Bob',
        connected: true,
        socketId: 'socket-2',
        resumeToken: 'tok',
      });

      const res = await request(
        baseUrl,
        'POST',
        `/api/admin/parties/${party.partyId}/members/guest-1/kick`,
        { cookies: session, headers: { 'x-csrf-token': csrfToken } }
      );
      expect(res.status).toBe(200);
      expect(res.body.removed).toBe(true);
      expect(res.body.partyDeleted).toBe(false);
      expect(getParty(party.partyId)?.members.has('guest-1')).toBe(false);
    });

    it('deletes the party when the last member is kicked', async () => {
      const { party } = createParty('host-1', 'Alice', 'socket-1');

      const res = await request(
        baseUrl,
        'POST',
        `/api/admin/parties/${party.partyId}/members/host-1/kick`,
        { cookies: session, headers: { 'x-csrf-token': csrfToken } }
      );
      expect(res.status).toBe(200);
      expect(res.body.partyDeleted).toBe(true);
      expect(getParty(party.partyId)).toBeUndefined();
    });
  });
});

describe('admin routes when disabled', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    registerAdminRoutes(app);

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('unexpected address');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('responds 503 on login when admin env is not configured', async () => {
    const res = await request(baseUrl, 'POST', '/api/admin/login', {
      body: { username: 'x', password: 'y' },
    });
    expect(res.status).toBe(503);
  });

  it('responds 503 on protected routes when disabled', async () => {
    const res = await request(baseUrl, 'GET', '/api/admin/parties');
    expect(res.status).toBe(503);
  });
});
