import type { Server } from 'socket.io';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/src/constants';
import { registerGame } from './handlers/socketHandlers';

export const definition = {
  id: 'secret-signals',
  name: 'Secret Signals',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
} as const;

/**
 * Game Hub plugin entry point.
 * Registers Socket.IO handlers on `/g/<gameId>`.
 */
export function register(io: Server, namespace = `/g/${definition.id}`) {
  return registerGame(io, namespace);
}

export const handler = { definition, register };
