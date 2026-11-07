import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: { actionTimeout: 10_000, navigationTimeout: 10_000 },
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
});
