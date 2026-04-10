import { Registry } from 'prom-client';

// Isolate a fresh registry for each test to avoid cross-test state.
let testRegistry: Registry;

vi.mock('../server/metrics/registry', () => {
  return {
    get metricsRegistry() {
      return testRegistry;
    },
  };
});

// Dynamic imports so mocked registry is picked up.
async function importMetrics() {
  return await import('../server/metrics/metrics');
}
async function importSocketHandlerMetrics() {
  return await import('../server/observability/socketHandlerMetrics');
}
async function importHttpMetrics() {
  return await import('../server/metrics/httpMetrics');
}

beforeEach(() => {
  testRegistry = new Registry();
  vi.resetModules();
});

describe('metrics/metrics – prom-client backed counters and histograms', () => {
  it('recordSocketEventEnd increments counter and observes histogram on the registry', async () => {
    const { recordSocketEventStart, recordSocketEventEnd } = await importMetrics();

    const start = recordSocketEventStart({
      namespace: '/party',
      event: 'createParty',
      gameId: 'blackout',
    });
    recordSocketEventEnd(start, { result: 'ok' });

    const output = await testRegistry.metrics();

    expect(output).toContain('platform_socket_events_total');
    expect(output).toContain('namespace="/party"');
    expect(output).toContain('event="createParty"');
    expect(output).toContain('game_id="blackout"');
    expect(output).toContain('result="ok"');

    expect(output).toContain('platform_event_latency_seconds');
  });

  it('setNamespaceConnectionCount exposes a gauge on the registry', async () => {
    const { setNamespaceConnectionCount } = await importMetrics();

    setNamespaceConnectionCount({ namespace: '/g/imposter', gameId: 'imposter' }, 42);

    const output = await testRegistry.metrics();
    expect(output).toContain('platform_socket_connections_open');
    expect(output).toContain('42');
  });

  it('incrementPartyLifecycle increments the lifecycle counter', async () => {
    const { incrementPartyLifecycle } = await importMetrics();

    incrementPartyLifecycle({ event: 'joinParty', result: 'error', reason: 'name_taken' });

    const output = await testRegistry.metrics();
    expect(output).toContain('platform_party_lifecycle_total');
    expect(output).toContain('event="joinParty"');
    expect(output).toContain('reason="name_taken"');
  });

  it('omits empty optional labels (gameId, reason) from metric output', async () => {
    const { recordSocketEventStart, recordSocketEventEnd, incrementPartyLifecycle } =
      await importMetrics();

    const start = recordSocketEventStart({ namespace: '/party', event: 'disconnect' });
    recordSocketEventEnd(start, { result: 'ok' });
    incrementPartyLifecycle({ event: 'leaveParty', result: 'ok' });

    const output = await testRegistry.metrics();

    // game_id should NOT appear for events without a gameId
    const eventLine = output
      .split('\n')
      .find((l: string) => l.includes('platform_socket_events_total') && l.includes('disconnect'));
    expect(eventLine).toBeDefined();
    expect(eventLine).not.toContain('game_id=');

    // reason should NOT appear when not provided
    const lifecycleLine = output
      .split('\n')
      .find(
        (l: string) => l.includes('platform_party_lifecycle_total') && l.includes('leaveParty')
      );
    expect(lifecycleLine).toBeDefined();
    expect(lifecycleLine).not.toContain('reason=');
  });
});

describe('observability/socketHandlerMetrics – prom-client backed', () => {
  it('finishSuccess records counter and histogram on the registry', async () => {
    const { startSocketHandlerInstrumentation } = await importSocketHandlerMetrics();

    const instrumentation = startSocketHandlerInstrumentation('/party', 'createParty');
    instrumentation.finishSuccess();

    const output = await testRegistry.metrics();
    expect(output).toContain('platform_socket_handler_total');
    expect(output).toContain('platform_socket_handler_duration_seconds');
    expect(output).toContain('result="ok"');
  });

  it('wrapCallback records error when result.ok is false', async () => {
    const { startSocketHandlerInstrumentation } = await importSocketHandlerMetrics();

    const instrumentation = startSocketHandlerInstrumentation('/party', 'joinParty');
    const callback = vi.fn();
    const wrapped = instrumentation.wrapCallback(callback);
    wrapped({ ok: false, error: 'not found' });

    expect(callback).toHaveBeenCalledWith({ ok: false, error: 'not found' });

    const output = await testRegistry.metrics();
    expect(output).toContain('result="error"');
  });

  it('only records once even if finish is called multiple times', async () => {
    const { startSocketHandlerInstrumentation } = await importSocketHandlerMetrics();

    const instrumentation = startSocketHandlerInstrumentation('/party', 'createParty');
    instrumentation.finishSuccess();
    instrumentation.finishError(); // should be ignored

    const output = await testRegistry.metrics();
    const totalLine = output
      .split('\n')
      .find(
        (l: string) =>
          l.startsWith('platform_socket_handler_total') && l.includes('event="createParty"')
      );
    expect(totalLine).toContain('1'); // count = 1, not 2
    expect(totalLine).toContain('result="ok"'); // first call wins
  });
});

describe('metrics/httpMetrics – /metrics endpoint', () => {
  it('serves Prometheus text format and increments scrape counter on success', async () => {
    const { registerMetricsRoutes } = await importHttpMetrics();

    // Minimal Express mock
    let registeredHandler: (req: unknown, res: unknown, next: unknown) => void;
    const app = {
      get: vi.fn((path: string, handler: typeof registeredHandler) => {
        if (path === '/metrics') registeredHandler = handler;
      }),
    };
    registerMetricsRoutes(app as never);

    const res = { set: vi.fn(), send: vi.fn() };
    const next = vi.fn();

    await registeredHandler!({}, res, next);

    expect(res.set).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/'));
    expect(next).not.toHaveBeenCalled();

    const body: string = res.send.mock.calls[0][0];
    expect(body).toContain('platform_metrics_scrape_total');
  });
});
