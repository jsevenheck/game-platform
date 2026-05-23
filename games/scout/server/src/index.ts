import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { getSessionRoom, deleteRoom } from './models/room';
import { registerScout } from './socketHandlers';

interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const definition: GameDefinition = {
  id: 'scout',
  name: 'Scout',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  return registerScout(io, namespace);
}

export function cleanupMatch(matchKey: string): void {
  const roomCode = getSessionRoom(matchKey);
  if (roomCode) {
    deleteRoom(roomCode);
    gameLogger.info({ matchKey, roomCode }, 'cleaned up scout match');
    return;
  }
  gameLogger.debug({ matchKey }, 'scout cleanup requested for unknown match');
}
