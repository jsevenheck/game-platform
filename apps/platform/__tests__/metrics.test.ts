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
  delete process.env.METRICS_ENABLED;
  delete process.env.METRICS_AUTH_TOKEN;
  delete process.env.NODE_ENV;
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

    incrementPartyLifecycle({ event: 'joinParty', result: 'rejected', reason: 'name_taken' });

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

  it('wrapCallback records rejected when result.ok is false', async () => {
    const { startSocketHandlerInstrumentation } = await importSocketHandlerMetrics();

    const instrumentation = startSocketHandlerInstrumentation('/party', 'joinParty');
    const callback = vi.fn();
    const wrapped = instrumentation.wrapCallback(callback);
    wrapped({ ok: false, error: 'not found' });

    expect(callback).toHaveBeenCalledWith({ ok: false, error: 'not found' });

    const output = await testRegistry.metrics();
    expect(output).toContain('result="rejected"');
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
  function createExpressAppMock() {
    let registeredHandler: (req: any, res: any, next: any) => void;
    const app = {
      get: vi.fn((path: string, handler: typeof registeredHandler) => {
        if (path === '/metrics') registeredHandler = handler;
      }),
    };

    return {
      app,
      getHandler: () => registeredHandler,
    };
  }

  function createResponseMock() {
    const res = {
      set: vi.fn(),
      status: vi.fn(function (this: any) {
        return this;
      }),
      send: vi.fn(),
      end: vi.fn(),
    };

    return res;
  }

  it('serves Prometheus text format and increments scrape counter on success', async () => {
    const { registerMetricsRoutes } = await importHttpMetrics();
    const { app, getHandler } = createExpressAppMock();
    registerMetricsRoutes(app as never);

    const res = createResponseMock();
    const next = vi.fn();

    await getHandler()!({ headers: {}, get: vi.fn() }, res, next);

    expect(res.set).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/'));
    expect(next).not.toHaveBeenCalled();

    const body: string = res.send.mock.calls[0][0];
    expect(body).toContain('platform_metrics_scrape_total');
  });

  it('returns 404 when metrics are disabled', async () => {
    process.env.METRICS_ENABLED = 'false';

    const { registerMetricsRoutes } = await importHttpMetrics();
    const { app, getHandler } = createExpressAppMock();
    registerMetricsRoutes(app as never);

    const res = createResponseMock();
    await getHandler()!({ headers: {}, get: vi.fn() }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalled();
  });

  it('requires an auth token when configured', async () => {
    process.env.METRICS_AUTH_TOKEN = 'secret-token';

    const { registerMetricsRoutes } = await importHttpMetrics();
    const { app, getHandler } = createExpressAppMock();
    registerMetricsRoutes(app as never);

    const res = createResponseMock();
    await getHandler()!({ headers: {}, get: vi.fn(() => undefined) }, res, vi.fn());

    expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Unauthorized');
  });

  it('accepts a bearer token when configured', async () => {
    process.env.METRICS_AUTH_TOKEN = 'secret-token';

    const { registerMetricsRoutes } = await importHttpMetrics();
    const { app, getHandler } = createExpressAppMock();
    registerMetricsRoutes(app as never);

    const req = {
      headers: { authorization: 'Bearer secret-token' },
      get: vi.fn((name: string) => (name === 'authorization' ? 'Bearer secret-token' : undefined)),
    };
    const res = createResponseMock();
    const next = vi.fn();

    await getHandler()!(req, res, next);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.set).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/'));
    expect(next).not.toHaveBeenCalled();
  });
});
