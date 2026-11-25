import { defineConfig, type ReporterDescription } from '@playwright/test';

// The github reporter turns each failure into a check annotation, readable without log access.
const ciReporters: ReporterDescription[] = process.env.CI ? [['github']] : [];

export default defineConfig({
  testDir: './e2e',
  // Helper unit tests under e2e/support run in Vitest, not against the desktop app.
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/support/warm-up.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: { actionTimeout: 10_000, navigationTimeout: 10_000 },
  expect: { timeout: 10_000 },
  reporter: [
    ...ciReporters,
    ['list'],
    ['html', { open: 'never' }],
    ['./e2e/support/startup-profile-reporter.ts'],
  ],
});
