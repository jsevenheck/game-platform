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

export const allProjects = [
  platformProject,
  blackoutProject,
  imposterProject,
  secretSignalsProject,
  flip7Project,
];
