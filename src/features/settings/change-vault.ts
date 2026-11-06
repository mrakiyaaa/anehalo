import type { FolderAccess } from '@/features/onboarding/FolderAccess';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { success } from '@/features/storage/repository-result';

export async function prepareVaultChange(
  path: string,
  folderAccess: FolderAccess,
  createRepository: (path: string) => NoteRepository,
  flushNotes: () => Promise<RepositoryResult<void>>,
): Promise<RepositoryResult<void>> {
  const saved = await flushNotes();
  if (!saved.ok) return saved;
  const writable = await folderAccess.validate(path);
  if (!writable.ok) return writable;
  const initialized = await createRepository(path).initializeVault();
  return initialized.ok ? success(undefined) : initialized;
}
