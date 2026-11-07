import { isTauri } from '@tauri-apps/api/core';
import { error } from '@tauri-apps/plugin-log';
import type { RepositoryErrorCode } from '@/features/storage/repository-result';

type ErrorEvent = 'unhandled-error' | 'unhandled-rejection' | 'render-error' | 'save-failed';

export function logFailure(event: ErrorEvent, code?: RepositoryErrorCode): void {
  if (!isTauri()) return;
  // Error messages, paths, stacks, and rejection values can contain private note text.
  void error(JSON.stringify({ event, ...(code ? { code } : {}) })).catch(() => {
    console.error('Anehalo could not write a diagnostic event.');
  });
}

export function observeUnhandledErrors(): void {
  window.addEventListener('error', () => logFailure('unhandled-error'));
  window.addEventListener('unhandledrejection', () => logFailure('unhandled-rejection'));
}
