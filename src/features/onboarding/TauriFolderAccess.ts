import { invoke } from '@tauri-apps/api/core';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { ScanBudget } from '@/features/storage/ScanBudget';
import { validateSavedVaultPath } from './vault-location';
import type { FolderAccess } from './FolderAccess';

export class TauriFolderAccess implements FolderAccess {
  async choose(): Promise<RepositoryResult<string | null>> {
    try {
      return success(await invoke<string | null>('pick_vault_location'));
    } catch (error) {
      return failure(describeStorageError(error, 'Could not choose a location.'));
    }
  }

  async validate(path: string): Promise<RepositoryResult<void>> {
    const location = validateSavedVaultPath(path);
    if (!location.ok) return location;
    try {
      await new ScanBudget().wait(invoke('prepare_vault', { vaultPath: path, create: true }));
      return success(undefined);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not prepare this notes folder.'));
    }
  }
}
