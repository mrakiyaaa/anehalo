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
      testTimeout: 15_000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary', 'lcov'],
        include: [
          'src/features/storage/*.ts',
          'src/features/editor/{NoteAutoSaver,NoteDraft,persist-note-draft}.ts',
          'src/features/note-links/NoteLinkRewriter.ts',
          'src/features/search/{SearchIndex,SearchTextProcessor,IndexedNoteRepository,search-text,search-processing}.ts',
          'src/features/export/*.ts',
        ],
        exclude: ['**/*.test.*', '**/InMemory*.ts', '**/use-*.ts', '**/*-context.ts'],
        thresholds: {
          'src/features/storage/**': { lines: 85 },
          'src/features/editor/**': { lines: 85 },
          'src/features/note-links/**': { lines: 85 },
          'src/features/search/**': { lines: 85 },
          'src/features/export/**': { lines: 85 },
        },
      },
      // Keep editor interaction tests responsive while jsdom workers share a desktop CPU.
      maxWorkers: 2,
      css: { include: [/globals\.css\?raw$/] },
    },
  }),
);
