import type { Server } from 'socket.io';

export interface GameServerModule {
  definition: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  };
  /** Register Socket.IO handlers for the game on the given namespace path */
  registerServer: (io: Server, namespacePath: string) => void;
  /** Tear down the game room associated with the given matchKey */
  cleanupMatch: (matchKey: string) => void;
}

// ─── Blackout ─────────────────────────────────────────────────────────────────

import {
  definition as blackoutDef,
  register as blackoutRegister,
  cleanupMatch as blackoutCleanup,
} from '../../../../games/blackout/server/src/index';

const blackoutModule: GameServerModule = {
  definition: blackoutDef,
  registerServer(io: Server, namespacePath: string) {
    blackoutRegister(io, namespacePath);
  },
  cleanupMatch: blackoutCleanup,
};

// ─── Imposter ─────────────────────────────────────────────────────────────────

import {
  definition as imposterDef,
  register as imposterRegister,
  cleanupMatch as imposterCleanup,
} from '../../../../games/imposter/server/src/index';

const imposterModule: GameServerModule = {
  definition: imposterDef,
  registerServer(io: Server, namespacePath: string) {
    imposterRegister(io, namespacePath);
  },
  cleanupMatch: imposterCleanup,
};

// ─── Secret Signals ───────────────────────────────────────────────────────────

import {
  definition as secretSignalsDef,
  register as secretSignalsRegister,
  cleanupMatch as secretSignalsCleanup,
} from '../../../../games/secret-signals/server/src/index';

const secretSignalsModule: GameServerModule = {
  definition: secretSignalsDef,
  registerServer(io: Server, namespacePath: string) {
    secretSignalsRegister(io, namespacePath);
  },
  cleanupMatch: secretSignalsCleanup,
};

// ─── Flip 7 ───────────────────────────────────────────────────────────────────

import {
  definition as flip7Def,
  register as flip7Register,
  cleanupMatch as flip7Cleanup,
} from '../../../../games/flip7/server/src/index';

const flip7Module: GameServerModule = {
  definition: flip7Def,
  registerServer(io: Server, namespacePath: string) {
    flip7Register(io, namespacePath);
  },
  cleanupMatch: flip7Cleanup,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const gameRegistry = new Map<string, GameServerModule>([
  ['blackout', blackoutModule],
  ['imposter', imposterModule],
  ['secret-signals', secretSignalsModule],
  ['flip7', flip7Module],
]);

export function getGame(gameId: string): GameServerModule | undefined {
  return gameRegistry.get(gameId);
}
