import type { Folder, Note, VaultTree } from '@/types/notes';
import type { RepositoryResult } from '@/features/storage/repository-result';

export interface CreateNoteInput {
  readonly folder?: string | null;
  readonly title?: string;
  readonly content?: string;
}

export interface TrashEntry {
  readonly originalPath: string;
  readonly trashPath: string;
  readonly deletedAt: number;
}

export interface NoteRepository {
  initializeVault(): Promise<RepositoryResult<void>>;
  listTree(): Promise<RepositoryResult<VaultTree>>;
  readNote(relativePath: string): Promise<RepositoryResult<Note>>;
  writeNote(relativePath: string, content: string): Promise<RepositoryResult<Note>>;
  createNote(input?: CreateNoteInput): Promise<RepositoryResult<Note>>;
  renameNote(relativePath: string, title: string): Promise<RepositoryResult<Note>>;
  deleteNote(relativePath: string): Promise<RepositoryResult<TrashEntry>>;
  createFolder(name: string, parent?: string | null): Promise<RepositoryResult<Folder>>;
  renameFolder(relativePath: string, name: string): Promise<RepositoryResult<Folder>>;
  deleteFolder(relativePath: string): Promise<RepositoryResult<TrashEntry>>;
}
