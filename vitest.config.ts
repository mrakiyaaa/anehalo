import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      clearMocks: true,
      restoreMocks: true,
      // Keep editor interaction tests responsive while jsdom workers share a desktop CPU.
      maxWorkers: 4,
      css: { include: [/globals\.css\?raw$/] },
    },
  }),
);
