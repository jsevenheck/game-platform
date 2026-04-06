import type { Bindings, Logger } from 'pino';
import { readLoggingConfig } from './logger';

export interface SocketLike {
  id: string;
  data?: Record<string, unknown>;
  onAny?: ((handler: (event: string, ...args: unknown[]) => void) => void) | undefined;
}

function readSocketString(
  data: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = data?.[key];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createSocketLogger(
  parent: Logger,
  socket: SocketLike,
  bindings: Bindings = {}
): Logger {
  const socketBindings: Bindings = {
    socketId: socket.id,
    ...bindings,
  };

  const sessionId = readSocketString(socket.data, 'sessionId');
  const playerId = readSocketString(socket.data, 'playerId');

  if (sessionId) {
    socketBindings.sessionId = sessionId;
  }
  if (playerId) {
    socketBindings.playerId = playerId;
  }

  return parent.child(socketBindings);
}

export function summarizeSocketArg(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { type: 'error', message: value.message };
  }
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length };
  }

  switch (typeof value) {
    case 'string':
      return { type: 'string', length: value.length };
    case 'number':
    case 'boolean':
      return value;
    case 'object':
      return {
        type: 'object',
        keys: Object.keys(value as Record<string, unknown>)
          .sort()
          .slice(0, 8),
      };
    default:
      return { type: typeof value };
  }
}

export function attachSocketEventDebugLogging(
  socket: SocketLike,
  logger: Logger,
  enabled = readLoggingConfig().socketEvents
): void {
  if (!enabled) return;
  if (typeof socket.onAny !== 'function') return;

  socket.onAny((event, ...args) => {
    logger.debug(
      {
        event,
        argSummary: args.map(summarizeSocketArg),
      },
      'socket event'
    );
  });
}
