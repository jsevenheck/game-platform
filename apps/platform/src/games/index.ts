import type { Component } from 'vue';

export interface PlatformGameModule {
  definition: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  };
  loadClient: () => Promise<{ default: Component }>;
}

export const clientGameRegistry: PlatformGameModule[] = [
  {
    definition: {
      id: 'blackout',
      name: 'Blackout',
      minPlayers: 3,
      maxPlayers: 20,
    },
    loadClient: () => import('@blackout-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'imposter',
      name: 'Imposter',
      minPlayers: 3,
      maxPlayers: 16,
    },
    loadClient: () => import('@imposter-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'secret-signals',
      name: 'Secret Signals',
      minPlayers: 4,
      maxPlayers: 24,
    },
    loadClient: () => import('@secret-signals-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'flip7',
      name: 'Flip 7',
      minPlayers: 3,
      maxPlayers: 18,
    },
    loadClient: () => import('@flip7-ui/PlatformAdapter.vue'),
  },
];

export function getClientGame(gameId: string): PlatformGameModule | undefined {
  return clientGameRegistry.find((g) => g.definition.id === gameId);
}
