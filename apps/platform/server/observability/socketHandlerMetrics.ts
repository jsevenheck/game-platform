import { Counter, Histogram } from 'prom-client';
import { metricsRegistry } from '../metrics/registry';
import {
  recordSocketEventStart,
  recordSocketEventEnd,
  type SocketEventStart,
} from '../metrics/metrics';

export type SocketHandlerResult = 'ok' | 'rejected' | 'failed';

const socketHandlerTotal = new Counter({
  name: 'platform_socket_handler_total',
  help: 'Total socket handler invocations by outcome.',
  labelNames: ['namespace', 'event', 'result'] as const,
  registers: [metricsRegistry],
});

const socketHandlerDuration = new Histogram({
  name: 'platform_socket_handler_duration_seconds',
  help: 'Socket handler execution duration in seconds by outcome.',
  labelNames: ['namespace', 'event', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export interface SocketHandlerInstrumentation {
  finish: (result: SocketHandlerResult) => void;
  finishSuccess: () => void;
  finishRejected: () => void;
  finishError: () => void;
  wrapCallback: <T extends { ok?: boolean }>(cb: (result: T) => void) => (result: T) => void;
}

/**
 * Start instrumentation for a single socket handler invocation.
 *
 * Records to `platform_socket_handler_total` and
 * `platform_socket_handler_duration_seconds` unconditionally.
 *
 * When `gameId` is supplied the outcome is **also** recorded to
 * `platform_socket_events_total` and `platform_event_latency_seconds`, giving
 * full per-game event coverage in those metrics.
 */
export function startSocketHandlerInstrumentation(
  namespace: string,
  event: string,
  gameId?: string
): SocketHandlerInstrumentation {
  const startedAt = process.hrtime.bigint();
  let finished = false;

  const eventStart: SocketEventStart | undefined = gameId
    ? recordSocketEventStart({ namespace, event, gameId })
    : undefined;

  const finish = (result: SocketHandlerResult): void => {
    if (finished) {
      return;
    }
    finished = true;

    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = { namespace, event, result };
    socketHandlerTotal.inc(labels);
    socketHandlerDuration.observe(labels, durationSeconds);

    if (eventStart) {
      recordSocketEventEnd(eventStart, { result });
    }
  };

  return {
    finish,
    finishSuccess: () => finish('ok'),
    finishRejected: () => finish('rejected'),
    finishError: () => finish('failed'),
    wrapCallback: <T extends { ok?: boolean }>(cb: (result: T) => void) => {
      return (result: T) => {
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
          finish('rejected');
        } else {
          finish('ok');
        }
        cb(result);
      };
    },
  };
}
