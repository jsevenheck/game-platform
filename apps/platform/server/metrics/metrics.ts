export type MetricResult = 'ok' | 'error';

export interface MetricDefinition<Label extends string> {
  name: string;
  help: string;
  labelNames: readonly Label[];
}

export type MetricLabels<Label extends string> = Partial<Record<Label, string>>;

interface MetricSample {
  labels: Record<string, string>;
  value: number;
}

function normalizeLabels<Label extends string>(
  labelNames: readonly Label[],
  labels: MetricLabels<Label>
): Record<string, string> {
  return labelNames.reduce<Record<string, string>>((acc, labelName) => {
    const value = labels[labelName];
    if (typeof value === 'string' && value.length > 0) {
      acc[labelName] = value;
    }
    return acc;
  }, {});
}

function serializeLabels(labels: Record<string, string>): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join('|');
}

export interface Counter<Label extends string> extends MetricDefinition<Label> {
  inc(labels?: MetricLabels<Label>, value?: number): void;
  getValues(): MetricSample[];
}

export interface Gauge<Label extends string> extends MetricDefinition<Label> {
  inc(labels?: MetricLabels<Label>, value?: number): void;
  dec(labels?: MetricLabels<Label>, value?: number): void;
  set(labels: MetricLabels<Label> | undefined, value: number): void;
  getValues(): MetricSample[];
}

export interface Histogram<Label extends string> extends MetricDefinition<Label> {
  observe(labels: MetricLabels<Label> | undefined, value: number): void;
  getValues(): MetricSample[];
}

function mapToSamples(entries: Map<string, MetricSample>): MetricSample[] {
  return Array.from(entries.values()).map((sample) => ({
    ...sample,
    labels: { ...sample.labels },
  }));
}

export function createCounter<Label extends string>(
  definition: MetricDefinition<Label>
): Counter<Label> {
  const values = new Map<string, MetricSample>();

  return {
    ...definition,
    inc(labels = {}, value = 1): void {
      const normalized = normalizeLabels(definition.labelNames, labels);
      const key = serializeLabels(normalized);
      const entry = values.get(key);

      if (entry) {
        entry.value += value;
        return;
      }

      values.set(key, { labels: normalized, value });
    },
    getValues(): MetricSample[] {
      return mapToSamples(values);
    },
  };
}

export function createGauge<Label extends string>(
  definition: MetricDefinition<Label>
): Gauge<Label> {
  const values = new Map<string, MetricSample>();

  function setValue(labels: MetricLabels<Label> | undefined, value: number): void {
    const normalized = normalizeLabels(definition.labelNames, labels ?? {});
    const key = serializeLabels(normalized);
    values.set(key, { labels: normalized, value });
  }

  return {
    ...definition,
    inc(labels = {}, value = 1): void {
      const normalized = normalizeLabels(definition.labelNames, labels);
      const key = serializeLabels(normalized);
      const entry = values.get(key);
      if (entry) {
        entry.value += value;
        return;
      }
      values.set(key, { labels: normalized, value });
    },
    dec(labels = {}, value = 1): void {
      const normalized = normalizeLabels(definition.labelNames, labels);
      const key = serializeLabels(normalized);
      const entry = values.get(key);
      if (entry) {
        entry.value -= value;
        return;
      }
      values.set(key, { labels: normalized, value: -value });
    },
    set: setValue,
    getValues(): MetricSample[] {
      return mapToSamples(values);
    },
  };
}

export function createHistogram<Label extends string>(
  definition: MetricDefinition<Label>
): Histogram<Label> {
  const values = new Map<string, MetricSample>();

  return {
    ...definition,
    observe(labels, value): void {
      const normalized = normalizeLabels(definition.labelNames, labels ?? {});
      const key = serializeLabels(normalized);
      const entry = values.get(key);
      if (entry) {
        entry.value += value;
        return;
      }
      values.set(key, { labels: normalized, value });
    },
    getValues(): MetricSample[] {
      return mapToSamples(values);
    },
  };
}

type CommonLabel = 'namespace' | 'event' | 'gameId' | 'result' | 'reason';
type ConnectionLabel = 'namespace' | 'gameId';
type PartyLifecycleLabel = 'event' | 'result' | 'reason';

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

export const socketEventsTotal = createCounter<CommonLabel>({
  name: 'gp_socket_events_total',
  help: 'Total number of handled socket events.',
  labelNames: ['namespace', 'event', 'gameId', 'result', 'reason'],
});

export const socketEventDurationSeconds = createHistogram<CommonLabel>({
  name: 'gp_socket_event_duration_seconds',
  help: 'Cumulative duration of handled socket events in seconds.',
  labelNames: ['namespace', 'event', 'gameId', 'result', 'reason'],
});

export const activeConnections = createGauge<ConnectionLabel>({
  name: 'gp_active_connections',
  help: 'Current number of active socket connections by namespace and game.',
  labelNames: ['namespace', 'gameId'],
});

export const partyLifecycleTotal = createCounter<PartyLifecycleLabel>({
  name: 'gp_party_lifecycle_total',
  help: 'Total party lifecycle transitions and actions.',
  labelNames: ['event', 'result', 'reason'],
});

export function recordSocketEventStart(labels: SocketEventMetricLabels): SocketEventStart {
  return {
    startedAt: process.hrtime.bigint(),
    labels,
  };
}

export function recordSocketEventEnd(start: SocketEventStart, end: SocketEventEnd): void {
  const durationSeconds = Number(process.hrtime.bigint() - start.startedAt) / 1_000_000_000;
  const labels = {
    namespace: start.labels.namespace,
    event: start.labels.event,
    gameId: start.labels.gameId,
    result: end.result,
    reason: end.reason,
  };

  socketEventsTotal.inc(labels);
  socketEventDurationSeconds.observe(labels, durationSeconds);
}

export function setNamespaceConnectionCount(
  labels: { namespace: string; gameId?: string },
  count: number
): void {
  activeConnections.set({ namespace: labels.namespace, gameId: labels.gameId }, count);
}

export function incrementPartyLifecycle(labels: {
  event: string;
  result: MetricResult;
  reason?: string;
}): void {
  partyLifecycleTotal.inc(labels);
}
