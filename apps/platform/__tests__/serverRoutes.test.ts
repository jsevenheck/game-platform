import express from 'express';
import { createServer } from 'http';
import { registerHttpRoutes } from '../server/httpRoutes';

/**
 * Verify that /health is registered before the SPA catch-all so it is reachable
 * even when static assets exist.
 */
describe('server route ordering', () => {
  it('/health responds with JSON before the SPA catch-all', async () => {
    const app = express();
    registerHttpRoutes(app, process.cwd());

    const server = createServer(app);

    const response = await new Promise<{ status: number; body: string }>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('unexpected address');
        const port = addr.port;

        const http = require('http');
        http.get(`http://127.0.0.1:${port}/health`, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: data });
            server.close();
          });
        });
      });
    });

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    // Readiness detail, not just liveness: a probe that only proves the
    // listener is bound cannot see a saturated event loop.
    expect(body.gamesRegistered).toBeGreaterThan(0);
    expect(typeof body.eventLoopLagMs).toBe('number');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('answers unmatched /api routes with JSON 404 rather than the SPA shell', async () => {
    const app = express();
    registerHttpRoutes(app, process.cwd());

    const server = createServer(app);

    const response = await new Promise<{ status: number; body: string }>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('unexpected address');

        const http = require('http');
        http.get(`http://127.0.0.1:${addr.port}/api/does-not-exist`, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: data });
            server.close();
          });
        });
      });
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ ok: false, error: 'Not found' });
  });
});
