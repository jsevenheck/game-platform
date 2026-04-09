import { type Express } from 'express';
import { Counter } from 'prom-client';
import { metricsRegistry } from './registry';

const metricsScrapeTotal = new Counter({
  name: 'platform_metrics_scrape_total',
  help: 'Self-observation counter for the /metrics scrape handler.',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export function registerMetricsRoutes(app: Express): void {
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.set('Content-Type', metricsRegistry.contentType);
      res.send(await metricsRegistry.metrics());
      metricsScrapeTotal.inc({ result: 'ok' });
    } catch (error) {
      metricsScrapeTotal.inc({ result: 'error' });
      next(error);
    }
  });
}
