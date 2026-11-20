import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { ThumbnailFiles } from './thumbnail-files';

/** %LOCALAPPDATA%\<app id>\thumbnails; the capability allows only this folder. */
export class TauriThumbnailFiles implements ThumbnailFiles {
  private directory: Promise<string> | null = null;

  private folder(): Promise<string> {
    this.directory ??= (async () => {
      const directory = await join(await appLocalDataDir(), 'thumbnails');
      await mkdir(directory, { recursive: true });
      return directory;
    })();
    return this.directory;
  }

  private async path(name: string) {
    return join(await this.folder(), name);
  }

  async read(name: string) {
    const path = await this.path(name);
    return (await exists(path)) ? readFile(path) : null;
  }

  async write(name: string, bytes: Uint8Array) {
    // Written in place: a torn thumbnail is only a cosmetic glitch, and the next render replaces it.
    await writeFile(await this.path(name), bytes);
  }

  async remove(name: string) {
    const path = await this.path(name);
    if (await exists(path)) await remove(path);
  }
}
