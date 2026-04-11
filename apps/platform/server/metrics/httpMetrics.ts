import { type Express, type Request } from 'express';
import type { Logger } from 'pino';
import { Counter } from 'prom-client';
import { createComponentLogger, parseBooleanEnv } from '../logging/logger';
import { metricsRegistry } from './registry';

export interface MetricsHttpConfig {
  enabled: boolean;
  authToken?: string;
  production: boolean;
}

const metricsScrapeTotal = new Counter({
  name: 'platform_metrics_scrape_total',
  help: 'Self-observation counter for the /metrics scrape handler.',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export function readMetricsHttpConfig(env: NodeJS.ProcessEnv = process.env): MetricsHttpConfig {
  const environment = env.NODE_ENV?.trim().toLowerCase();
  const production = environment === 'production';
  const authToken = env.METRICS_AUTH_TOKEN?.trim() || undefined;

  return {
    production,
    enabled: parseBooleanEnv(env.METRICS_ENABLED, !production),
    authToken,
  };
}

function readBearerToken(req: Pick<Request, 'headers' | 'get'>): string | undefined {
  const authorizationHeader = req.get('authorization') ?? req.headers.authorization;
  const candidate = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const match = candidate.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function readMetricsAccessToken(req: Pick<Request, 'headers' | 'get'>): string | undefined {
  const bearerToken = readBearerToken(req);
  if (bearerToken) {
    return bearerToken;
  }

  const headerValue = req.get('x-metrics-token') ?? req.headers['x-metrics-token'];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

export function registerMetricsRoutes(
  app: Express,
  parent: Logger = createComponentLogger('metrics-http'),
  config: MetricsHttpConfig = readMetricsHttpConfig()
): void {
  const logger = parent.child({ path: '/metrics' });

  if (!config.enabled) {
    logger.info('metrics endpoint disabled');
    app.get('/metrics', (_req, res) => {
      res.status(404).end();
    });
    return;
  }

  if (config.authToken) {
    logger.info('metrics endpoint enabled with token protection');
  } else if (config.production) {
    logger.warn('metrics endpoint enabled without token protection');
  }

  app.get('/metrics', async (req, res, next) => {
    if (config.authToken && readMetricsAccessToken(req) !== config.authToken) {
      metricsScrapeTotal.inc({ result: 'unauthorized' });
      res.set('WWW-Authenticate', 'Bearer');
      res.status(401).send('Unauthorized');
      return;
    }

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
