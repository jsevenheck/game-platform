import type { Component } from 'vue';

export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
  /** Short catalog/category label, e.g. "Social deduction". */
  category?: string;
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
      category: 'Word · Deception',
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
      category: 'Social deduction',
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
      category: 'Team · Strategy',
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
      category: 'Push your luck',
    },
    loadClient: () => import('@flip7-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'scout',
      name: 'Scout',
      minPlayers: 2,
      maxPlayers: 5,
    },
    platformMeta: {
      icon: '🎯',
      gradFrom: '#065f46',
      gradTo: '#022c22',
      description: 'Outwit your friends in this ladder-climbing card trick game',
      category: 'Card tactics',
    },
    loadClient: () => import('@scout-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'estimate',
      name: 'Estimate',
      minPlayers: 2,
      maxPlayers: 12,
    },
    platformMeta: {
      icon: '📏',
      gradFrom: '#0c4a6e',
      gradTo: '#082f49',
      description: 'Guess a number for each question — closest to the truth wins the round',
      category: 'Trivia · Numbers',
    },
    loadClient: () => import('@estimate-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'kritzelagent',
      name: 'Kritzelagent',
      minPlayers: 5,
      maxPlayers: 12,
    },
    platformMeta: {
      icon: '✏️',
      gradFrom: '#7c2d12',
      gradTo: '#2a120b',
      description: 'Zeichnet gemeinsam — findet den Agenten ohne Motivkenntnis',
      category: 'Zeichnen · Deduktion',
    },
    loadClient: () => import('@kritzelagent-ui/PlatformAdapter.vue'),
  },
  {
    definition: {
      id: 'herd-mentality',
      name: 'Herd Mentality',
      minPlayers: 4,
      maxPlayers: 20,
    },
    platformMeta: {
      icon: '🐄',
      gradFrom: '#3f2a14',
      gradTo: '#1d1208',
      description: 'Find the answer the largest part of the herd will choose',
      category: 'Mehrheit · Party',
    },
    loadClient: () => import('@herd-mentality-ui/PlatformAdapter.vue'),
  },
];
export function getClientGame(gameId: string): PlatformGameModule | undefined {
  return clientGameRegistry.find((g) => g.definition.id === gameId);
}
