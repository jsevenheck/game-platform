import { collectDefaultMetrics, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  service: 'platform-server',
  env: process.env.NODE_ENV ?? 'development',
});

collectDefaultMetrics({
  register: metricsRegistry,
});
