import { defineConfig, type ReporterDescription } from '@playwright/test';

// The github reporter turns each failure into a check annotation, readable without log access.
const ciReporters: ReporterDescription[] = process.env.CI ? [['github']] : [];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: { actionTimeout: 10_000, navigationTimeout: 10_000 },
  expect: { timeout: 10_000 },
  reporter: [...ciReporters, ['list'], ['html', { open: 'never' }]],
});
