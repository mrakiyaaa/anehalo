import type { FolderAccess } from '@/features/onboarding/FolderAccess';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export class InMemoryFolderAccess implements FolderAccess {
  selection: string | null = null;
  readonly unwritablePaths = new Set<string>();
  readonly validatedPaths: string[] = [];
  choose(): Promise<RepositoryResult<string | null>> {
    return Promise.resolve(success(this.selection));
  }
  validate(path: string): Promise<RepositoryResult<void>> {
    this.validatedPaths.push(path);
    return Promise.resolve(
      this.unwritablePaths.has(path)
        ? failure({
            code: 'permission-denied',
            message: 'This folder is not writable. Choose another folder.',
          })
        : success(undefined),
    );
  }
}
