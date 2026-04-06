import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import pino, { type Bindings, type Logger, type LoggerOptions } from 'pino';

export interface LoggingConfig {
  level: string;
  pretty: boolean;
  socketEvents: boolean;
  production: boolean;
}

const DEFAULT_REDACT_PATHS = [
  'authorization',
  'cookie',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.authorization',
  '*.cookie',
  'token',
  'joinToken',
  'resumeToken',
  '*.token',
  '*.joinToken',
  '*.resumeToken',
];

const nodeRequire = createRequire(__filename);

export function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function readLoggingConfig(env: NodeJS.ProcessEnv = process.env): LoggingConfig {
  const environment = env.NODE_ENV?.trim().toLowerCase();
  const production = environment === 'production';
  const testing = environment === 'test';
  const defaultLevel = production ? 'info' : testing ? 'warn' : 'debug';

  return {
    production,
    level: env.LOG_LEVEL?.trim() || defaultLevel,
    pretty: parseBooleanEnv(env.LOG_PRETTY, !production && !testing),
    socketEvents: parseBooleanEnv(env.LOG_SOCKET_EVENTS, false),
  };
}

export function buildLoggerOptions(config: LoggingConfig = readLoggingConfig()): LoggerOptions {
  const options: LoggerOptions = {
    level: config.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
      }),
    },
    redact: {
      paths: DEFAULT_REDACT_PATHS,
      remove: true,
    },
  };

  const prettyTarget = config.pretty ? resolvePrettyTransportTarget() : undefined;
  if (prettyTarget) {
    options.transport = {
      target: prettyTarget,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,host',
      },
    };
  }

  return options;
}

export function resolvePrettyTransportTarget(
  resolvePackage: (specifier: string) => string = nodeRequire.resolve
): string | undefined {
  try {
    resolvePackage('pino-pretty');
    return 'pino-pretty';
  } catch {
    return undefined;
  }
}

export function createRootLogger(config: LoggingConfig = readLoggingConfig()): Logger {
  return pino(buildLoggerOptions(config));
}

export const logger = createRootLogger();

export function createComponentLogger(component: string, bindings: Bindings = {}): Logger {
  return logger.child({ component, ...bindings });
}

export function createRequestId(headerValue: string | string[] | undefined): string {
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = candidate?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : randomUUID();
}

export function toLoggableError(error: unknown): Error | { message: string } {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return { message: error };

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

let processLoggingRegistered = false;

export function registerProcessLogging(parent: Logger = logger): void {
  if (processLoggingRegistered) return;
  processLoggingRegistered = true;

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    parent.fatal({ err: error, origin }, 'uncaught exception');
  });

  process.on('unhandledRejection', (reason) => {
    parent.error({ err: toLoggableError(reason) }, 'unhandled promise rejection');
  });

  process.on('uncaughtException', () => {
    parent.flush();
    setImmediate(() => process.exit(1));
  });
}
