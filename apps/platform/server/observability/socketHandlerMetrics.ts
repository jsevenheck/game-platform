import { Counter, Histogram } from 'prom-client';
import { metricsRegistry } from '../metrics/registry';

export type SocketHandlerResult = 'ok' | 'error';

const socketHandlerTotal = new Counter({
  name: 'platform_socket_handler_total',
  help: 'Total socket handler invocations.',
  labelNames: ['namespace', 'event', 'result'] as const,
  registers: [metricsRegistry],
});

const socketHandlerDuration = new Histogram({
  name: 'platform_socket_handler_duration_seconds',
  help: 'Socket handler execution duration in seconds.',
  labelNames: ['namespace', 'event', 'result'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export interface SocketHandlerInstrumentation {
  finish: (result: SocketHandlerResult) => void;
  finishSuccess: () => void;
  finishError: () => void;
  wrapCallback: <T extends { ok?: boolean }>(cb: (result: T) => void) => (result: T) => void;
}

export function startSocketHandlerInstrumentation(
  namespace: string,
  event: string
): SocketHandlerInstrumentation {
  const startedAt = process.hrtime.bigint();
  let finished = false;

  const finish = (result: SocketHandlerResult): void => {
    if (finished) {
      return;
    }
    finished = true;

    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = { namespace, event, result };
    socketHandlerTotal.inc(labels);
    socketHandlerDuration.observe(labels, durationSeconds);
  };

  return {
    finish,
    finishSuccess: () => finish('ok'),
    finishError: () => finish('error'),
    wrapCallback: <T extends { ok?: boolean }>(cb: (result: T) => void) => {
      return (result: T) => {
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
          finish('error');
        } else {
          finish('ok');
        }
        cb(result);
      };
    },
  };
}
