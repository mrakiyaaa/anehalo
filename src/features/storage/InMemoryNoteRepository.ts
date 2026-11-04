import { FileSystemNoteRepository } from '@/features/storage/FileSystemNoteRepository';
import {
  InMemoryVaultFileSystem,
  type MemoryEntry,
} from '@/features/storage/InMemoryVaultFileSystem';

export class InMemoryNoteRepository extends FileSystemNoteRepository {
  readonly memoryFileSystem: InMemoryVaultFileSystem;

  constructor(seed: readonly MemoryEntry[] = [], now: () => number = Date.now) {
    const fileSystem = new InMemoryVaultFileSystem(seed, now);
    super(fileSystem);
    this.memoryFileSystem = fileSystem;
  }
}
