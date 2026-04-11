import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { registerGame } from './handlers/socketHandlers';
import { getSessionRoom, deleteRoom } from './models/room';

export const definition = {
  id: 'secret-signals',
  name: 'Secret Signals',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
} as const;

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

/**
 * Platform game module entry point.
 * Registers Socket.IO handlers on `/g/<gameId>`.
 */
export function register(io: Server, namespace = `/g/${definition.id}`) {
  return registerGame(io, namespace);
}

export function cleanupMatch(matchKey: string): void {
  const roomCode = getSessionRoom(matchKey);
  if (roomCode) {
    deleteRoom(roomCode);
    gameLogger.info({ matchKey, roomCode }, 'cleaned up match');
    return;
  }

  gameLogger.debug({ matchKey }, 'cleanup requested for unknown match');
}

export const handler = { definition, register };
