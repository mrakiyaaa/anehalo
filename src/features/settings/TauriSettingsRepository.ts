import { runtimePaths } from '@/app/runtime-paths';
import { defaultSettings } from '@/features/settings/AppSettings';
import { FileSettingsRepository } from '@/features/settings/FileSettingsRepository';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { VaultFileService } from '@/features/storage/VaultFileService';
import { describeStorageError } from '@/features/storage/repository-result';

export class TauriSettingsRepository extends FileSettingsRepository {
  constructor() {
    const files = new VaultFileService(
      new TauriVaultFileSystem(async () => (await runtimePaths()).settings),
    );
    super(
      {
        read: async () => {
          await files.fileSystem.initialize();
          try {
            return await files.fileSystem.readText('settings.json');
          } catch (error) {
            if (describeStorageError(error, '').code === 'not-found') return null;
            throw error;
          }
        },
        write: async (content) => {
          await files.fileSystem.initialize();
          await files.atomicWrite('settings.json', content);
        },
      },
      async () => defaultSettings((await runtimePaths()).vault),
    );
  }
}
