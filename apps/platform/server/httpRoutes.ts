import express, { type Express } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';

export function registerHttpRoutes(
  app: Express,
  clientDist = resolve(__dirname, '../../../../client')
): void {
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('{*path}', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }
}
