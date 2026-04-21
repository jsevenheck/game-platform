import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { registerFlip7 } from './socketHandlers';
import { getSessionRoom, deleteRoom } from './models/room';

interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const definition: GameDefinition = {
  id: 'flip7',
  name: 'Flip 7',
  minPlayers: 3,
  maxPlayers: 18,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  return registerFlip7(io, namespace);
}

export function cleanupMatch(matchKey: string): void {
  const roomCode = getSessionRoom(matchKey);
  if (roomCode) {
    deleteRoom(roomCode);
    gameLogger.info({ matchKey, roomCode }, 'cleaned up flip7 match');
    return;
  }
  gameLogger.debug({ matchKey }, 'flip7 cleanup requested for unknown match');
}
