import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright config — runs e2e tests against the platform.
 *
 * Each game's e2e/ tests will need updating to work with the platform
 * flow (party → launch game) instead of the old standalone flow.
 * The webServer below starts the full platform (server + client).
 */
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export default defineConfig({
  testDir: '.',
  testMatch: ['games/*/e2e/**/*.spec.ts', 'apps/platform/e2e/**/*.spec.ts'],
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 8,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `${pnpmCommand} -C apps/platform dev:server`,
      port: 3000,
      reuseExistingServer: false,
      env: { E2E_TESTS: '1' },
    },
    {
      command: `${pnpmCommand} -C apps/platform dev:client`,
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
