import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { logFailure } from '@/features/diagnostics/error-logging';
import { describeStorageError, failure, success } from '@/features/storage/repository-result';
import type { FileExplorer } from './FileExplorer';

export class TauriFileExplorer implements FileExplorer {
  async reveal(absolutePath: string) {
    try {
      await revealItemInDir(absolutePath);
      return success(undefined);
    } catch (error) {
      const result = failure(
        describeStorageError(error, 'Could not show the file in File Explorer.'),
      );
      if (!result.ok) logFailure('reveal-failed', result.error.code);
      return result;
    }
  }
}
