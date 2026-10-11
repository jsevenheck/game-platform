import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createSocketOriginPolicy } from '../server/observability/socketOrigin';

const origin = 'https://games.example.test';
const policy = createSocketOriginPolicy({ NODE_ENV: 'production', SOCKET_ALLOWED_ORIGINS: origin });

describe('Socket.IO handshake origin policy', () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const http = createServer();
    server = new Server(http, {
      allowRequest: policy.allowRequest,
      cors: { origin: policy.origins },
    });
    server.of('/party');
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const address = http.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    url = `http://127.0.0.1:${address.port}/party`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  for (const transport of ['polling', 'websocket']) {
    it.each([
      [origin, true],
      ['https://untrusted.example', false],
      [undefined, true],
    ] as const)(`${transport}: admits origin %s = %s`, async (suppliedOrigin, allowed) => {
      const socket = connect(url, {
        transports: [transport],
        extraHeaders: suppliedOrigin === undefined ? {} : { Origin: suppliedOrigin },
        reconnection: false,
        forceNew: true,
        autoConnect: false,
        timeout: 2000,
      });
      try {
        const accepted = await new Promise<boolean>((resolve) => {
          socket.once('connect', () => resolve(true));
          socket.once('connect_error', () => resolve(false));
          socket.connect();
        });
        expect(accepted).toBe(allowed);
      } finally {
        socket.disconnect();
      }
    });
  }

  it('rejects missing production configuration for browser connections', () => {
    const empty = createSocketOriginPolicy({ NODE_ENV: 'production' });
    expect(empty.accepts(origin)).toBe(false);
    expect(empty.accepts(undefined)).toBe(true);
  });

  it('uses explicit development origins rather than a wildcard', () => {
    const dev = createSocketOriginPolicy({ NODE_ENV: 'development' });
    expect(dev.accepts('http://localhost:5173')).toBe(true);
    expect(dev.accepts('https://untrusted.example')).toBe(false);
  });

  it.each(['*', 'null', 'https://games.example.test/path', 'https://user:pass@games.example.test'])(
    'rejects unsafe configured entries: %s',
    (entry) => {
      expect(() => createSocketOriginPolicy({ SOCKET_ALLOWED_ORIGINS: entry })).toThrow();
    }
  );

  it('uses exact matches, not attacker-controlled suffixes', () => {
    expect(policy.accepts(`${origin}.evil.test`)).toBe(false);
    expect(policy.accepts('null')).toBe(false);
    expect(policy.accepts('')).toBe(false);
  });
});
