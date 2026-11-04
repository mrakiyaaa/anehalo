import type { Note } from '@/types/notes';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';

export interface CaptureState {
  readonly relativePath: string | null;
  readonly folder: string | null;
  readonly draft: string;
  readonly savedContent: string;
  readonly status: 'idle' | 'saving' | 'saved' | 'error';
  readonly error: RepositoryError | null;
}

export function emptyCapture(): CaptureState {
  return {
    relativePath: null,
    folder: null,
    draft: '',
    savedContent: '',
    status: 'idle',
    error: null,
  };
}

export function persistCapture(
  repository: NoteRepository,
  capture: CaptureState,
): Promise<RepositoryResult<Note | null>> {
  if (capture.draft === capture.savedContent || (!capture.relativePath && !capture.draft.trim()))
    return Promise.resolve(success(null));
  return capture.relativePath
    ? repository.writeNote(capture.relativePath, capture.draft)
    : repository.createNote({ folder: capture.folder, content: capture.draft });
}
