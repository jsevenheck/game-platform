import {
  buildLoggerOptions,
  createRootLogger,
  readLoggingConfig,
  resolvePrettyTransportTarget,
  type LoggingConfig,
} from '../server/logging/logger';
import {
  attachSocketEventDebugLogging,
  createSocketLogger,
  summarizeSocketArg,
} from '../server/logging/socketLogger';

describe('server logging helpers', () => {
  it('defaults to non-pretty logging during tests and info logging in production', () => {
    expect(readLoggingConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toEqual({
      production: false,
      level: 'warn',
      pretty: false,
      socketEvents: false,
    });

    expect(readLoggingConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual({
      production: true,
      level: 'info',
      pretty: false,
      socketEvents: false,
    });
  });

  it('creates socket child loggers with namespace and socket context', () => {
    const config: LoggingConfig = {
      production: false,
      level: 'debug',
      pretty: false,
      socketEvents: false,
    };
    const rootLogger = createRootLogger(config);
    const socketLogger = createSocketLogger(
      rootLogger,
      {
        id: 'socket-1',
        data: {
          sessionId: 'match-1',
          playerId: 'player-1',
        },
      },
      { namespace: '/g/blackout' }
    );

    expect(socketLogger.bindings()).toEqual(
      expect.objectContaining({
        namespace: '/g/blackout',
        socketId: 'socket-1',
        sessionId: 'match-1',
        playerId: 'player-1',
      })
    );
  });

  it('summarizes socket payloads without exposing string contents', () => {
    expect(summarizeSocketArg('secret-word')).toEqual({ type: 'string', length: 11 });
    expect(summarizeSocketArg({ roomCode: 'ABCD', resumeToken: 'secret', playerId: 'p1' })).toEqual(
      {
        type: 'object',
        keys: ['playerId', 'resumeToken', 'roomCode'],
      }
    );
  });

  it('redacts inviteCode only in production logger config', () => {
    const devOptions = buildLoggerOptions({
      production: false,
      level: 'debug',
      pretty: false,
      socketEvents: false,
    });
    const prodOptions = buildLoggerOptions({
      production: true,
      level: 'info',
      pretty: false,
      socketEvents: false,
    });

    const devPaths =
      devOptions.redact && !Array.isArray(devOptions.redact) ? devOptions.redact.paths : [];
    const prodPaths =
      prodOptions.redact && !Array.isArray(prodOptions.redact) ? prodOptions.redact.paths : [];

    expect(devPaths).not.toContain('inviteCode');
    expect(prodPaths).toContain('inviteCode');
    expect(prodPaths).toContain('*.inviteCode');
  });

  it('falls back cleanly when pino-pretty is unavailable', () => {
    expect(
      resolvePrettyTransportTarget(() => {
        throw new Error('missing');
      })
    ).toBeUndefined();
  });

  it('attaches socket debug logging only when explicitly enabled', () => {
    const onAny = vi.fn<(handler: (event: string, ...args: unknown[]) => void) => void>();
    const debug = vi.fn();

    attachSocketEventDebugLogging({ id: 'socket-1', onAny }, { debug } as never, false);
    expect(onAny).not.toHaveBeenCalled();

    attachSocketEventDebugLogging({ id: 'socket-1', onAny }, { debug } as never, true);
    expect(onAny).toHaveBeenCalledTimes(1);

    const handler = onAny.mock.calls[0]?.[0];
    expect(handler).toBeTypeOf('function');

    handler?.('startGame', { roomCode: 'ABCD', resumeToken: 'secret', playerId: 'p1' }, 'signal');
    expect(debug).toHaveBeenCalledWith(
      {
        event: 'startGame',
        argSummary: [
          {
            type: 'object',
            keys: ['playerId', 'resumeToken', 'roomCode'],
          },
          { type: 'string', length: 6 },
        ],
      },
      'socket event'
    );
  });
});
