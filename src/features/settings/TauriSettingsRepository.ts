import { appConfigDir, documentDir, join } from '@tauri-apps/api/path';
import { defaultSettings } from '@/features/settings/AppSettings';
import { FileSettingsRepository } from '@/features/settings/FileSettingsRepository';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { VaultFileService } from '@/features/storage/VaultFileService';

export class TauriSettingsRepository extends FileSettingsRepository {
  constructor() {
    const files = new VaultFileService(new TauriVaultFileSystem(appConfigDir));
    super(
      {
        read: async () => {
          await files.fileSystem.initialize();
          return (await files.fileSystem.metadata('settings.json'))
            ? files.fileSystem.readText('settings.json')
            : null;
        },
        write: async (content) => {
          await files.fileSystem.initialize();
          await files.atomicWrite('settings.json', content);
        },
      },
      async () => defaultSettings(await join(await documentDir(), 'Anehalo')),
    );
  }
}
