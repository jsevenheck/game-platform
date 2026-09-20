import { resolve } from 'node:path';

const GAMES_ROOT = resolve(__dirname, 'games');

export const platformProject = {
  test: {
    name: 'platform',
    include: ['apps/platform/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const blackoutProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'blackout/core/src') }],
  },
  test: {
    name: 'blackout',
    include: ['games/blackout/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const imposterProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'imposter/core/src') }],
  },
  test: {
    name: 'imposter',
    include: ['games/imposter/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const secretSignalsProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'secret-signals/core/src') }],
  },
  test: {
    name: 'secret-signals',
    include: ['games/secret-signals/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const flip7Project = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'flip7/core/src') }],
  },
  test: {
    name: 'flip7',
    include: ['games/flip7/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const scoutProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'scout/core/src') }],
  },
  test: {
    name: 'scout',
    include: ['games/scout/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const estimateProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'estimate/core/src') }],
  },
  test: {
    name: 'estimate',
    include: ['games/estimate/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const kritzelagentProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'kritzelagent/core/src') }],
  },
  test: {
    name: 'kritzelagent',
    include: ['games/kritzelagent/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const herdMentalityProject = {
  resolve: {
    alias: [{ find: '@shared', replacement: resolve(GAMES_ROOT, 'herd-mentality/core/src') }],
  },
  test: {
    name: 'herd-mentality',
    include: ['games/herd-mentality/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
};

export const allProjects = [
  platformProject,
  blackoutProject,
  imposterProject,
  secretSignalsProject,
  flip7Project,
  scoutProject,
  estimateProject,
  kritzelagentProject,
  herdMentalityProject,
];
