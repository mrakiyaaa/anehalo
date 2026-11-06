import type { Note } from '@/types/notes';
import type { RepositoryError } from '@/features/storage/repository-result';
import type { LinkRename } from '@/features/note-links/NoteLinkRewriter';

export interface NoteDraft {
  readonly identifier: string;
  readonly note: Note;
  readonly content: string;
  readonly title: string;
  readonly dirty: boolean;
  readonly status: 'saving' | 'saved' | 'retrying';
  readonly error: RepositoryError | null;
  readonly externalNote: Note | null;
  readonly isMissing: boolean;
  readonly isSerializationBlocked: boolean;
  readonly documentVersion: number;
  readonly linkRenames: readonly LinkRename[];
}

export function createNoteDraft(note: Note, identifier: string = crypto.randomUUID()): NoteDraft {
  return {
    identifier,
    note,
    content: note.content,
    title: note.title,
    dirty: false,
    status: 'saved',
    error: null,
    externalNote: null,
    isMissing: false,
    isSerializationBlocked: false,
    documentVersion: 0,
    linkRenames: [],
  };
}

export function hasDraftChanges(draft: NoteDraft): boolean {
  return (
    draft.isSerializationBlocked ||
    draft.content !== draft.note.content ||
    draft.title !== draft.note.title
  );
}

export function noteChanged(first: Note, second: Note): boolean {
  return first.modifiedAt !== second.modifiedAt || first.content !== second.content;
}
