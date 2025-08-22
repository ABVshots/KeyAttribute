import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'E2E_BYPASS_AUTH=1 PORT=3001 npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    storageState: 'tests/e2e/.auth/user.json',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
