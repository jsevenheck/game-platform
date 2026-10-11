import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'node:http';
import { registerAdminRoutes } from '../server/admin';
import { PasswordVerificationBusyError } from '../server/passwordVerification';

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('../server/passwordVerification', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/passwordVerification')>();
  return { ...actual, createPasswordVerifier: () => verify };
});

describe('admin password verification HTTP boundary', () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    vi.stubEnv('ADMIN_USERNAME', 'operator');
    vi.stubEnv('ADMIN_PASSWORD_HASH', 'test-hash');
    vi.stubEnv('ADMIN_JWT_SECRET', 'test-secret');
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.get('/health', (_req, res) => res.json({ ok: true }));
    registerAdminRoutes(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Missing test port');
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    verify.mockReset();
  });

  async function login(username = 'operator') {
    return fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'password' }),
    });
  }

  it.each([new PasswordVerificationBusyError(), new Error('Worker failed')])(
    'responds with bounded generic 503 on verifier failure',
    async (error) => {
      verify.mockRejectedValue(error);
      const response = await login();
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('1');
      expect(await response.json()).toEqual({
        ok: false,
        error: 'Authentication temporarily unavailable',
      });
    }
  );

  it('keeps health requests responsive while password verification is pending', async () => {
    let complete!: (result: boolean) => void;
    verify.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        })
    );
    const pending = login('wrong-user');
    await vi.waitFor(() => expect(verify).toHaveBeenCalled());
    try {
      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(200);
    } finally {
      complete(true);
    }
    const response = await pending;
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'Invalid credentials' });
  });
});
