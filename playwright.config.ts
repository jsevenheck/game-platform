import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright config — runs e2e tests against the platform.
 *
 * Each game's e2e/ tests will need updating to work with the platform
 * flow (party → launch game) instead of the old standalone flow.
 * The webServer below starts the full platform (server + client).
 */
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const nodeCommand = process.platform === 'win32' ? `"${process.execPath}"` : process.execPath;

// Dedicated ports keep tests isolated from a developer's running instance.
const apiPort = Number(process.env.E2E_API_PORT ?? 3100);
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 5273);

export default defineConfig({
  testDir: '.',
  testMatch: ['games/*/e2e/**/*.spec.ts', 'apps/platform/e2e/**/*.spec.ts'],
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Multiplayer tests open several browser contexts per worker. Bound resource
  // pressure so request deadlines stay meaningful instead of failing on load.
  workers: 2,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${clientPort}`,
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
      command: `${nodeCommand} apps/platform/scripts/dev-server.cjs`,
      port: apiPort,
      reuseExistingServer: false,
      env: {
        E2E_TESTS: '1',
        PORT: String(apiPort),
        SOCKET_ALLOWED_ORIGINS: `http://localhost:${clientPort}`,
      },
    },
    {
      command: `${pnpmCommand} -C apps/platform dev:client --port ${clientPort} --strictPort`,
      port: clientPort,
      reuseExistingServer: false,
      env: { API_PORT: String(apiPort) },
      stderr: 'ignore',
    },
  ],
});
