import type { NoteDraft } from '@/features/editor/NoteDraft';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { success, type RepositoryResult } from '@/features/storage/repository-result';
import type { Note } from '@/types/notes';

export async function persistNoteDraft(
  repository: NoteRepository,
  draft: NoteDraft,
  committed: (note: Note, renamed: boolean) => void,
): Promise<RepositoryResult<void>> {
  let savedNote = draft.note;
  if (draft.content !== savedNote.content) {
    const written = await repository.writeNote(savedNote.relativePath, draft.content);
    if (!written.ok) return written;
    savedNote = written.value;
    committed(savedNote, false);
  }
  if (draft.title !== savedNote.title) {
    const renamed = await repository.renameNote(savedNote.relativePath, draft.title, {
      suffixDuplicates: true,
    });
    if (!renamed.ok) return renamed;
    committed(renamed.value, true);
  }
  return success(undefined);
}
