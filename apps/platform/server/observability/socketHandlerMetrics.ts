export type SocketHandlerResult = 'ok' | 'error';

interface SocketHandlerLabels {
  namespace: string;
  event: string;
  result: SocketHandlerResult;
}

const SOCKET_HANDLER_DURATION_BUCKETS_SECONDS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5,
] as const;

const socketHandlerTotals = new Map<string, number>();

interface HistogramSeries {
  count: number;
  sum: number;
  buckets: number[];
}

const socketHandlerDurationSeconds = new Map<string, HistogramSeries>();

function labelsKey(labels: SocketHandlerLabels): string {
  return `${labels.namespace}|${labels.event}|${labels.result}`;
}

function incSocketHandlerTotal(labels: SocketHandlerLabels): void {
  const key = labelsKey(labels);
  const current = socketHandlerTotals.get(key) ?? 0;
  socketHandlerTotals.set(key, current + 1);
}

function observeSocketHandlerDuration(labels: SocketHandlerLabels, seconds: number): void {
  const key = labelsKey(labels);
  const series = socketHandlerDurationSeconds.get(key) ?? {
    count: 0,
    sum: 0,
    buckets: new Array(SOCKET_HANDLER_DURATION_BUCKETS_SECONDS.length).fill(0),
  };

  series.count += 1;
  series.sum += seconds;

  for (const [index, upperBound] of SOCKET_HANDLER_DURATION_BUCKETS_SECONDS.entries()) {
    if (seconds <= upperBound) {
      series.buckets[index] += 1;
    }
  }

  socketHandlerDurationSeconds.set(key, series);
}

function recordSocketHandler(labels: SocketHandlerLabels, seconds: number): void {
  incSocketHandlerTotal(labels);
  observeSocketHandlerDuration(labels, seconds);
}

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
    recordSocketHandler({ namespace, event, result }, durationSeconds);
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
