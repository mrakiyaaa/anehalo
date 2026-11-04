import { FileSystemNoteRepository } from '@/features/storage/FileSystemNoteRepository';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';

export class TauriNoteRepository extends FileSystemNoteRepository {
  constructor() {
    super(new TauriVaultFileSystem());
  }
}
