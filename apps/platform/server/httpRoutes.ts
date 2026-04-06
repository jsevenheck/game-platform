import express, { type Express } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Registry } from 'prom-client';

export function registerHttpRoutes(
  app: Express,
  metricsRegistry: Registry,
  clientDist = resolve(__dirname, '../../../../client')
): void {
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/metrics', async (_req, res, next) => {
    try {
      res.setHeader('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } catch (error) {
      next(error);
    }
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('{*path}', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }
}
