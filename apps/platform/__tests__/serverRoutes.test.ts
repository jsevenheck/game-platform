import express from 'express';
import { createServer } from 'http';
import { Registry } from 'prom-client';
import { registerHttpRoutes } from '../server/httpRoutes';

/**
 * Verify that /health is registered before the SPA catch-all so it is reachable
 * even when static assets exist.
 */
describe('server route ordering', () => {
  it('/health responds with JSON before the SPA catch-all', async () => {
    const app = express();
    registerHttpRoutes(app, new Registry(), process.cwd());

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
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });
});
