import { defineConfig } from '@playwright/test';

const E2E_CLIENT_PORT = 4173;
const E2E_SERVER_PORT = 3101;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`,
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm exec tsx standalone-server/src/index.ts',
      port: E2E_SERVER_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        E2E_TESTS: '1',
        PORT: String(E2E_SERVER_PORT),
      },
    },
    {
      command: 'pnpm -C ui-vue dev',
      port: E2E_CLIENT_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        E2E_TESTS: '1',
        VITE_PORT: String(E2E_CLIENT_PORT),
        VITE_API_PORT: String(E2E_SERVER_PORT),
      },
    },
  ],
});
