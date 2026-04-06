import http from 'node:http';
import express from 'express';
import { createServer } from 'http';
import {
  createRequestLogger,
  isStaticAssetRequest,
  resolveHttpLogLevel,
  shouldIgnoreHttpRequest,
} from '../server/logging/requestLogger';

describe('request logger', () => {
  it('propagates request ids via response headers', async () => {
    const app = express();
    app.use(createRequestLogger());
    app.get('/ping', (_req, res) => {
      res.status(204).end();
    });

    const server = createServer(app);

    const response = await new Promise<{
      status: number;
      requestId: string | string[] | undefined;
    }>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('unexpected address');

        const req = http.request(
          {
            host: '127.0.0.1',
            port: addr.port,
            path: '/ping',
            method: 'GET',
            headers: {
              'X-Request-Id': 'external-123',
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => {
              resolve({
                status: res.statusCode ?? 0,
                requestId: res.headers['x-request-id'],
              });
              server.close();
            });
          }
        );

        req.end();
      });
    });

    expect(response.status).toBe(204);
    expect(response.requestId).toBe('external-123');
  });

  it('marks health checks as silent and 4xx responses as warnings', () => {
    expect(shouldIgnoreHttpRequest({ url: '/health?full=1' })).toBe(true);
    expect(isStaticAssetRequest({ url: '/assets/index-D6bluBOt.js' })).toBe(true);
    expect(resolveHttpLogLevel({ url: '/assets/index-D6bluBOt.js' }, { statusCode: 200 })).toBe(
      'silent'
    );
    expect(resolveHttpLogLevel({ url: '/assets/index-D6bluBOt.js' }, { statusCode: 404 })).toBe(
      'warn'
    );
    expect(resolveHttpLogLevel({ url: '/party/ABCD' }, { statusCode: 404 })).toBe('warn');
    expect(resolveHttpLogLevel({ url: '/party/ABCD' }, { statusCode: 204 })).toBe('info');
    expect(resolveHttpLogLevel({ url: '/party/ABCD' }, { statusCode: 500 })).toBe('error');
  });
});
