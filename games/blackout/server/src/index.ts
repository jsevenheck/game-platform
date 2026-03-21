import type { Server, Namespace } from 'socket.io';
import { registerBlackout } from './socketHandlers';

// Optional: define the hub contract locally so we don't need a dev dependency
interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}
interface GameHandler {
  definition: GameDefinition;
  register: (io: Server, namespace: Namespace) => void;
}

export const definition: GameDefinition = {
  id: 'blackout',
  name: 'Blackout',
  minPlayers: 3,
  maxPlayers: 20,
};

export function register(io: Server, namespace: Namespace): void {
  return registerBlackout(io, namespace);
}

export const handler: GameHandler = { definition, register };
