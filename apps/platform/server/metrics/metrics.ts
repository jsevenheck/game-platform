import { Counter, Gauge, Histogram } from 'prom-client';
import { metricsRegistry } from './registry';

export type MetricResult = 'ok' | 'error';

export interface SocketEventMetricLabels {
  namespace: string;
  event: string;
  gameId?: string;
}

export interface SocketEventStart {
  startedAt: bigint;
  labels: SocketEventMetricLabels;
}

export interface SocketEventEnd {
  result: MetricResult;
  reason?: string;
}

export const socketEventsTotal = new Counter({
  name: 'platform_socket_events_total',
  help: 'Total number of handled socket events.',
  labelNames: ['namespace', 'event', 'game_id', 'result', 'reason'] as const,
  registers: [metricsRegistry],
});

export const socketEventDurationSeconds = new Histogram({
  name: 'platform_event_latency_seconds',
  help: 'End-to-end latency for key party/game events.',
  labelNames: ['namespace', 'event', 'game_id', 'result', 'reason'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const namespaceConnectionsGauge = new Gauge({
  name: 'platform_socket_connections_open',
  help: 'Current open Socket.IO connections by namespace.',
  labelNames: ['namespace', 'game_id'] as const,
  registers: [metricsRegistry],
});

export const partyLifecycleTotal = new Counter({
  name: 'platform_party_lifecycle_total',
  help: 'Total party lifecycle transitions and actions.',
  labelNames: ['event', 'result', 'reason'] as const,
  registers: [metricsRegistry],
});

export function recordSocketEventStart(labels: SocketEventMetricLabels): SocketEventStart {
  return {
    startedAt: process.hrtime.bigint(),
    labels,
  };
}

export function recordSocketEventEnd(start: SocketEventStart, end: SocketEventEnd): void {
  const durationSeconds = Number(process.hrtime.bigint() - start.startedAt) / 1_000_000_000;
  const labelValues: Record<string, string> = {
    namespace: start.labels.namespace,
    event: start.labels.event,
    result: end.result,
  };
  if (start.labels.gameId) labelValues.game_id = start.labels.gameId;
  if (end.reason) labelValues.reason = end.reason;

  socketEventsTotal.inc(labelValues);
  socketEventDurationSeconds.observe(labelValues, durationSeconds);
}

export function setNamespaceConnectionCount(
  labels: { namespace: string; gameId?: string },
  count: number
): void {
  const labelValues: Record<string, string> = { namespace: labels.namespace };
  if (labels.gameId) labelValues.game_id = labels.gameId;
  namespaceConnectionsGauge.set(labelValues, count);
}

export function incrementPartyLifecycle(labels: {
  event: string;
  result: MetricResult;
  reason?: string;
}): void {
  const labelValues: Record<string, string> = {
    event: labels.event,
    result: labels.result,
  };
  if (labels.reason) labelValues.reason = labels.reason;
  partyLifecycleTotal.inc(labelValues);
}
