import type { Component } from 'vue';

export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
}

export interface PlatformGameModule {
  definition: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  };
  platformMeta?: PlatformGameMeta;
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
    platformMeta: {
      icon: '🌑',
      gradFrom: '#2d1b69',
      gradTo: '#120b2e',
      description: 'A word game of deception and darkness',
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
    platformMeta: {
      icon: '🕵️',
      gradFrom: '#5a0a1e',
      gradTo: '#1a0a10',
      description: 'Find the imposter among you',
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
    platformMeta: {
      icon: '📡',
      gradFrom: '#063a4a',
      gradTo: '#051520',
      description: 'Decode the signals, outsmart your team',
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
    platformMeta: {
      icon: '🃏',
      gradFrom: '#3d2800',
      gradTo: '#1a1200',
      description: 'Race to flip exactly 7 — no more, no less',
    },
    loadClient: () => import('@flip7-ui/PlatformAdapter.vue'),
  },
];

export function getClientGame(gameId: string): PlatformGameModule | undefined {
  return clientGameRegistry.find((g) => g.definition.id === gameId);
}
