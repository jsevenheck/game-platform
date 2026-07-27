// Stub for Phase 0 — full handler logic is added in Phase 3.
import type { Server } from 'socket.io';
import type { Logger } from 'pino';

export function registerEstimate(_io: Server, namespace: string, gameLogger: Logger): void {
  gameLogger.debug({ namespace }, 'registerEstimate stub (Phase 0)');
}
