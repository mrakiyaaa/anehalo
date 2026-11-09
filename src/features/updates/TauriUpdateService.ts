import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { runtimePaths } from '@/app/runtime-paths';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DownloadProgress, UpdateOffer, UpdateService } from './UpdateService';

const CHECK_TIMEOUT_MS = 30_000;

async function attempt<Value>(
  action: () => Promise<Value>,
  message: string,
): Promise<RepositoryResult<Value>> {
  try {
    return success(await action());
  } catch (error) {
    return failure(describeStorageError(error, message));
  }
}

export class TauriUpdateService implements UpdateService {
  private pending: Update | null = null;

  async isSupported(): Promise<boolean> {
    // Development builds and isolated test runs must never replace themselves with a release.
    if (import.meta.env.DEV || !isTauri()) return false;
    try {
      return !(await runtimePaths()).isolated;
    } catch {
      return false;
    }
  }

  private async requireSupport() {
    if (!(await this.isSupported())) throw new Error('Updates are turned off in this build.');
  }

  currentVersion() {
    return attempt(() => getVersion(), 'Could not read the Anehalo version.');
  }

  check(): Promise<RepositoryResult<UpdateOffer | null>> {
    return attempt(async () => {
      await this.requireSupport();
      const update = await check({ timeout: CHECK_TIMEOUT_MS });
      const previous = this.pending;
      this.pending = update;
      // Release the native handle of an offer that has been replaced or withdrawn.
      if (previous && previous !== update) await previous.close().catch(() => undefined);
      return update ? { version: update.version } : null;
    }, 'Could not check for updates.');
  }

  download(onProgress: (progress: DownloadProgress) => void): Promise<RepositoryResult<void>> {
    return attempt(async () => {
      await this.requireSupport();
      const update = this.pending;
      if (!update) throw new Error('There is no update to download.');
      let downloaded = 0;
      let total: number | null = null;
      await update.download((event) => {
        if (event.event === 'Started') {
          downloaded = 0;
          total = event.data.contentLength ?? null;
        } else if (event.event === 'Progress') downloaded += event.data.chunkLength;
        else return;
        onProgress({ downloaded, total });
      });
    }, 'Could not download the update.');
  }

  install(): Promise<RepositoryResult<void>> {
    return attempt(async () => {
      await this.requireSupport();
      if (!this.pending) throw new Error('There is no update to install.');
      await this.pending.install();
    }, 'Could not install the update.');
  }

  relaunch(): Promise<RepositoryResult<void>> {
    return attempt(async () => {
      await this.requireSupport();
      await relaunch();
    }, 'Could not restart Anehalo.');
  }
}
