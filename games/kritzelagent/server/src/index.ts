import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { deleteRoomByCode, getRoomBySession } from './models/room';
import { registerKritzelagent } from './socketHandlers';
import { getTopicLibrary } from './utils/topicLibrary';

interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const definition: GameDefinition = {
  id: 'kritzelagent',
  name: 'Kritzelagent',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  getTopicLibrary();
  registerKritzelagent(io, namespace, gameLogger);
}

export function cleanupMatch(matchKey: string): void {
  const room = getRoomBySession(matchKey);
  if (!room) {
    gameLogger.debug({ matchKey }, 'kritzelagent cleanup requested for unknown match');
    return;
  }
  deleteRoomByCode(room.roomCode);
  gameLogger.info({ matchKey, roomCode: room.roomCode }, 'cleaned up kritzelagent match');
}
