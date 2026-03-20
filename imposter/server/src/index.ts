import type { Server } from 'socket.io';
import { registerGame } from './handlers/socketHandlers';

export const definition = {
  id: 'imposter',
  name: 'Imposter',
  minPlayers: 3,
  maxPlayers: 16,
} as const;

/**
 * Game Hub plugin entry point.
 * Registers Socket.IO handlers on `/g/<gameId>`.
 */
export function register(io: Server, namespace = `/g/${definition.id}`) {
  return registerGame(io, namespace);
}

export const handler = { definition, register };
