import type { FolderAccess } from '@/features/onboarding/FolderAccess';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { validateSavedVaultPath } from './vault-location';

export class InMemoryFolderAccess implements FolderAccess {
  selection: string | null = null;
  readonly unwritablePaths = new Set<string>();
  readonly validatedPaths: string[] = [];
  readonly createdDirectories = new Set<string>();
  choose(): Promise<RepositoryResult<string | null>> {
    return Promise.resolve(success(this.selection));
  }
  validate(path: string): Promise<RepositoryResult<void>> {
    this.validatedPaths.push(path);
    const valid = validateSavedVaultPath(path);
    if (!valid.ok) return Promise.resolve(valid);
    const parent = path.replace(/[\\/]anehalo[\\/]*$/i, '');
    const writable = !this.unwritablePaths.has(path) && !this.unwritablePaths.has(parent);
    if (writable) this.createdDirectories.add(path);
    return Promise.resolve(
      !writable
        ? failure({
            code: 'permission-denied',
            message: 'This folder is not writable. Choose another folder.',
          })
        : success(undefined),
    );
  }
}
