import type { RepositoryResult } from '@/features/storage/repository-result';

/** Shows a vault file selected in the system file manager. */
export interface FileExplorer {
  reveal(absolutePath: string): Promise<RepositoryResult<void>>;
}
