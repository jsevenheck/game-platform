import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { deleteRoomByCode, getRoomBySession } from './models/room';
import { registerHerdMentality } from './socketHandlers';
import { getPromptLibrary } from './utils/promptLibrary';

interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export const definition: GameDefinition = {
  id: 'herd-mentality',
  name: 'Herd Mentality',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  // Eagerly validate and cache the production prompt asset during server startup.
  getPromptLibrary();
  return registerHerdMentality(io, namespace, gameLogger);
}

export function cleanupMatch(matchKey: string): void {
  const room = getRoomBySession(matchKey);
  if (room) {
    deleteRoomByCode(room.roomCode);
    gameLogger.info({ matchKey, roomCode: room.roomCode }, 'cleaned up herd-mentality match');
    return;
  }
  gameLogger.debug({ matchKey }, 'herd-mentality cleanup requested for unknown match');
}
