import type { Server } from 'socket.io';
import { registerBlackout } from './socketHandlers';
import { getSessionRoom, deleteRoom } from './models/room';

// Optional: define the hub contract locally so we don't need a dev dependency
interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}
interface GameHandler {
  definition: GameDefinition;
  register: (io: Server, namespace?: string) => void;
}

export const definition: GameDefinition = {
  id: 'blackout',
  name: 'Blackout',
  minPlayers: 3,
  maxPlayers: 20,
};

export function register(io: Server, namespace = `/g/${definition.id}`): void {
  return registerBlackout(io, namespace);
}

export function cleanupMatch(matchKey: string): void {
  const roomCode = getSessionRoom(matchKey);
  if (roomCode) {
    deleteRoom(roomCode);
  }
}

export const handler: GameHandler = { definition, register };
