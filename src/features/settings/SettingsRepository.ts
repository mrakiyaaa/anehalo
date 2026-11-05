import type { AppSettings } from '@/features/settings/AppSettings';
import type { RepositoryResult } from '@/features/storage/repository-result';

export interface SettingsRepository {
  defaults(): Promise<RepositoryResult<AppSettings>>;
  load(): Promise<RepositoryResult<AppSettings>>;
  save(settings: AppSettings): Promise<RepositoryResult<AppSettings>>;
}

export interface SettingsFile {
  read(): Promise<string | null>;
  write(content: string): Promise<void>;
}
