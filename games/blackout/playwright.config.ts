import { defineConfig, devices } from '@playwright/test';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
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
      command: `${pnpmCommand} dev:server`,
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `${pnpmCommand} dev:client`,
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
