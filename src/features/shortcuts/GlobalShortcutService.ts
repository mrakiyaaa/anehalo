import type { RepositoryResult } from '@/features/storage/repository-result';

export interface GlobalShortcutService {
  replace(shortcut: string, pressed: () => void): Promise<RepositoryResult<void>>;
  unregister(pressed?: () => void): Promise<RepositoryResult<void>>;
}
