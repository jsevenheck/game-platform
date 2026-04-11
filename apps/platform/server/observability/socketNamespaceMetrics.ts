import {
  type MetricResult,
  recordSocketEventEnd,
  recordSocketEventStart,
  setNamespaceConnectionCount,
} from '../metrics/metrics';

export interface NamespaceMetricLabels {
  namespace: string;
  gameId?: string;
}

export interface NamespaceLike {
  sockets?: Map<string, unknown>;
}

export function getNamespaceSocketCount(nsp: NamespaceLike): number {
  return nsp.sockets?.size ?? 0;
}

export function updateNamespaceConnectionMetric(
  labels: NamespaceMetricLabels,
  nsp: NamespaceLike
): void {
  setNamespaceConnectionCount(labels, getNamespaceSocketCount(nsp));
}

export function recordNamespaceConnection(labels: NamespaceMetricLabels, nsp: NamespaceLike): void {
  updateNamespaceConnectionMetric(labels, nsp);
  recordSocketEventEnd(recordSocketEventStart({ ...labels, event: 'connection' }), {
    result: 'ok',
  });
}

export function recordNamespaceDisconnect(
  labels: NamespaceMetricLabels,
  nsp: NamespaceLike,
  result: MetricResult = 'ok'
): void {
  updateNamespaceConnectionMetric(labels, nsp);
  recordSocketEventEnd(recordSocketEventStart({ ...labels, event: 'disconnect' }), {
    result,
  });
}
