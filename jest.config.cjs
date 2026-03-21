/** @type {import('jest').Config} */

const sharedTsconfig = {
  target: 'ES2020',
  module: 'CommonJS',
  moduleResolution: 'node',
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  types: ['node', 'jest'],
};

module.exports = {
  projects: [
    {
      displayName: 'platform',
      rootDir: 'apps/platform',
      preset: 'ts-jest',
      testEnvironment: 'node',
      clearMocks: true,
      testMatch: ['**/__tests__/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: sharedTsconfig }],
      },
    },
    {
      displayName: 'blackout',
      rootDir: 'games/blackout',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/core/src/$1',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: sharedTsconfig }],
      },
    },
    {
      displayName: 'imposter',
      rootDir: 'games/imposter',
      preset: 'ts-jest',
      testEnvironment: 'node',
      clearMocks: true,
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/core/src/$1',
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: sharedTsconfig }],
      },
    },
    {
      displayName: 'secret-signals',
      rootDir: 'games/secret-signals',
      preset: 'ts-jest',
      testEnvironment: 'node',
      clearMocks: true,
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/core/src/$1',
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: sharedTsconfig }],
      },
    },
  ],
};
