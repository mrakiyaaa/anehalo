import { defaultSettings } from '@/features/settings/AppSettings';
import { FileSettingsRepository } from '@/features/settings/FileSettingsRepository';
import type { SettingsFile } from '@/features/settings/SettingsRepository';

export class MemorySettingsFile implements SettingsFile {
  content: string | null;
  writeError: Error | null = null;
  constructor(content: string | null = null) {
    this.content = content;
  }
  read(): Promise<string | null> {
    return Promise.resolve(this.content);
  }
  write(content: string): Promise<void> {
    if (this.writeError) return Promise.reject(this.writeError);
    this.content = content;
    return Promise.resolve();
  }
}

export class InMemorySettingsRepository extends FileSettingsRepository {
  readonly file: MemorySettingsFile;
  constructor(content: string | null = null, vaultPath = 'Memory/Anehalo') {
    const file = new MemorySettingsFile(content);
    super(file, () => Promise.resolve(defaultSettings(vaultPath)));
    this.file = file;
  }
}
