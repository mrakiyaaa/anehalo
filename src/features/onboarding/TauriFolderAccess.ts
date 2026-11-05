import { open } from '@tauri-apps/plugin-dialog';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { FolderAccess } from '@/features/onboarding/FolderAccess';

export class TauriFolderAccess implements FolderAccess {
  async choose(): Promise<RepositoryResult<string | null>> {
    try {
      return success(
        await open({
          directory: true,
          multiple: false,
          recursive: true,
          title: 'Choose your Anehalo notes folder',
        }),
      );
    } catch (error) {
      return failure(describeStorageError(error, 'Could not open the folder picker.'));
    }
  }

  async validate(path: string): Promise<RepositoryResult<void>> {
    const files = new TauriVaultFileSystem(() => Promise.resolve(path));
    const probe = `.anehalo-${crypto.randomUUID()}.tmp`;
    let probeCreated = false;
    try {
      await files.initialize();
      await files.writeText(probe, 'Anehalo folder access check.');
      probeCreated = true;
      await files.removeTemporaryFile(probe);
      return success(undefined);
    } catch (error) {
      const original = describeStorageError(
        error,
        'This folder is not writable. Choose another folder or check its permissions.',
      );
      if (probeCreated)
        return failure({
          ...original,
          message: `${original.message} The access-check file could not be removed.`,
        });
      return failure(original);
    }
  }
}
