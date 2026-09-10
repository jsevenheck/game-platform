import express, { type Express } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { gameRegistry } from './registry/index';

/**
 * Event-loop lag above which the process is reported unhealthy.
 *
 * A liveness probe that only proves the HTTP listener is bound cannot
 * distinguish a healthy process from one whose single event loop is
 * saturated — which is precisely the failure mode a runaway synchronous
 * handler produces, and the state in which restarting actually helps.
 */
const EVENT_LOOP_LAG_UNHEALTHY_MS = 1_000;
const LAG_SAMPLE_INTERVAL_MS = 500;

let lastLagSampleAt = Date.now();
let observedLagMs = 0;

const lagSampler = setInterval(() => {
  const now = Date.now();
  // Anything beyond the scheduled interval is time the loop was blocked.
  observedLagMs = Math.max(0, now - lastLagSampleAt - LAG_SAMPLE_INTERVAL_MS);
  lastLagSampleAt = now;
}, LAG_SAMPLE_INTERVAL_MS);
lagSampler.unref?.();

/** Current event-loop lag estimate in milliseconds. Exported for tests. */
export function getEventLoopLagMs(): number {
  return observedLagMs;
}

export function registerHttpRoutes(
  app: Express,
  clientDist = resolve(__dirname, '../../../../client')
): void {
  app.get('/health', (_req, res) => {
    const lagMs = getEventLoopLagMs();
    const gamesRegistered = gameRegistry.size;
    const healthy = lagMs < EVENT_LOOP_LAG_UNHEALTHY_MS && gamesRegistered > 0;

    res.status(healthy ? 200 : 503).json({
      ok: healthy,
      eventLoopLagMs: lagMs,
      gamesRegistered,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // Any /api route that reached this far matched no handler above. Answer in
  // the content type an API client expects — without this, the SPA fallback
  // below returns index.html with status 200 for a mistyped endpoint, which
  // is confusing both for clients and when debugging.
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('{*path}', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }
}
