import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { deleteRoomByCode, getRoomBySession } from './models/room';
import { registerEstimate } from './socketHandlers';
import { getQuestionLibrary } from './utils/questionLibrary';

interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const definition: GameDefinition = {
  id: 'estimate',
  name: 'Estimate',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  // Eagerly validate and cache the production question asset during server startup.
  getQuestionLibrary();
  return registerEstimate(io, namespace, gameLogger);
}

export function cleanupMatch(matchKey: string): void {
  const room = getRoomBySession(matchKey);
  if (room) {
    deleteRoomByCode(room.roomCode);
    gameLogger.info({ matchKey, roomCode: room.roomCode }, 'cleaned up estimate match');
    return;
  }
  gameLogger.debug({ matchKey }, 'estimate cleanup requested for unknown match');
}
