import type { RepositoryResult } from '@/features/storage/repository-result';

export interface FolderAccess {
  choose(): Promise<RepositoryResult<string | null>>;
  validate(path: string): Promise<RepositoryResult<void>>;
}
