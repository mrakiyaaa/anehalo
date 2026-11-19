import { VaultFileService } from '@/features/storage/VaultFileService';
import type { VaultFileSystem } from '@/features/storage/VaultFileSystem';
import { VaultOperationQueue } from '@/features/storage/VaultOperationQueue';

/** File access and the one operation queue for a vault, shared by its note and diagram stores. */
export interface VaultStorage {
  readonly files: VaultFileService;
  readonly operations: VaultOperationQueue;
}

export function createVaultStorage(fileSystem: VaultFileSystem): VaultStorage {
  return {
    files: new VaultFileService(fileSystem),
    operations: new VaultOperationQueue(fileSystem),
  };
}
