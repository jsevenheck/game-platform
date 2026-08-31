import type { Server } from 'socket.io';
import { createComponentLogger } from '../../../../apps/platform/server/logging/logger';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';

export const definition = {
  id: 'kritzelagent',
  name: 'Kritzelagent',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
};

const gameLogger = createComponentLogger('game-server', { gameId: definition.id });

export function register(_io: Server, _namespace = `/g/${definition.id}`): void {
  gameLogger.debug('kritzelagent scaffold registered');
}

export function cleanupMatch(matchKey: string): void {
  gameLogger.debug({ matchKey }, 'kritzelagent cleanup requested');
}
