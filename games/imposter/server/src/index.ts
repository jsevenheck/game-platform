import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { registerGame, clearRoomTimers } from './handlers/socketHandlers';
import { getSessionRoom, deleteRoom } from './models/room';

export const definition = {
  id: 'imposter',
  name: 'Imposter',
  minPlayers: 3,
  maxPlayers: 16,
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
    clearRoomTimers(roomCode);
    deleteRoom(roomCode);
    gameLogger.info({ matchKey, roomCode }, 'cleaned up match');
    return;
  }

  gameLogger.debug({ matchKey }, 'cleanup requested for unknown match');
}

export const handler = { definition, register };
