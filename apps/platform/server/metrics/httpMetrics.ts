import { type Express } from 'express';
import { metricsRegistry } from './registry';

export function registerMetricsRoutes(app: Express): void {
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.set('Content-Type', metricsRegistry.contentType);
      res.send(await metricsRegistry.metrics());
    } catch (error) {
      next(error);
    }
  });
}
