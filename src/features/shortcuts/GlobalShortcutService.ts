import type { RepositoryResult } from '@/features/storage/repository-result';

export type GlobalShortcutAction = 'quick-note' | 'open';

export interface ShortcutRegistration {
  shortcut: string;
  pressed: () => void;
}

export interface GlobalShortcutService {
  replace(
    shortcut: string,
    pressed: () => void,
    action?: GlobalShortcutAction,
  ): Promise<RepositoryResult<void>>;
  unregister(pressed?: () => void, action?: GlobalShortcutAction): Promise<RepositoryResult<void>>;
}
