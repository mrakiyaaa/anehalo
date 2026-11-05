import {
  normalizeUserName,
  parseSettings,
  type AppSettings,
} from '@/features/settings/AppSettings';
import type { SettingsFile, SettingsRepository } from '@/features/settings/SettingsRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';

export class FileSettingsRepository implements SettingsRepository {
  constructor(
    private readonly settingsFile: SettingsFile,
    private readonly resolveDefaults: () => Promise<AppSettings>,
  ) {}

  async defaults(): Promise<RepositoryResult<AppSettings>> {
    try {
      return success(await this.resolveDefaults());
    } catch (error) {
      return failure(describeStorageError(error, 'Could not locate the default notes folder.'));
    }
  }

  async load(): Promise<RepositoryResult<AppSettings>> {
    const defaults = await this.defaults();
    if (!defaults.ok) return defaults;
    try {
      const content = await this.settingsFile.read();
      return success(content === null ? defaults.value : parseSettings(content, defaults.value));
    } catch (error) {
      return failure(describeStorageError(error, 'Could not load your settings.'));
    }
  }

  async save(settings: AppSettings): Promise<RepositoryResult<AppSettings>> {
    const normalized = { ...settings, userName: normalizeUserName(settings.userName) };
    try {
      await this.settingsFile.write(`${JSON.stringify(normalized, null, 2)}\n`);
      return success(normalized);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not save your settings.'));
    }
  }
}
