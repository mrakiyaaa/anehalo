import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { VaultFileSystem } from '@/features/storage/VaultFileSystem';

/**
 * Runs vault file operations one at a time. Notes and diagrams share one queue per vault, so
 * two creations in the same folder can never pick the same unique name.
 */
export class VaultOperationQueue {
  private queue: Promise<void> = Promise.resolve();
  private initialized = false;
  private resolvedVaultPath = '';

  constructor(private readonly fileSystem: VaultFileSystem) {}

  get vaultPath(): string {
    return this.resolvedVaultPath;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.resolvedVaultPath = await this.fileSystem.initialize();
    this.initialized = true;
  }

  run<Value>(action: string, operation: () => Promise<Value>): Promise<RepositoryResult<Value>> {
    const result = this.queue.then(async (): Promise<RepositoryResult<Value>> => {
      try {
        await this.initialize();
        return success(await operation());
      } catch (error) {
        return failure(describeStorageError(error, action));
      }
    });
    this.queue = result.then(() => undefined);
    return result;
  }
}
