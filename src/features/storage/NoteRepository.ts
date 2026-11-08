import type { Folder, Note, NoteSummary, VaultTree } from '@/types/notes';
import type { RepositoryResult } from '@/features/storage/repository-result';
import type { ScanLimits } from './ScanLimits';
export type { ScanLimits } from './ScanLimits';

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

export interface RenameNoteOptions {
  readonly suffixDuplicates?: boolean;
}

export interface NoteRepository {
  initializeVault(): Promise<RepositoryResult<void>>;
  listTree(limits?: ScanLimits): Promise<RepositoryResult<VaultTree>>;
  hydrateTree?(): Promise<RepositoryResult<VaultTree>>;
  readNote(relativePath: string): Promise<RepositoryResult<Note>>;
  readSnapshotNote?(
    relativePath: string,
    expectedSummary?: NoteSummary,
  ): Promise<RepositoryResult<Note>>;
  writeNote(relativePath: string, content: string): Promise<RepositoryResult<Note>>;
  createNote(input?: CreateNoteInput): Promise<RepositoryResult<Note>>;
  renameNote(
    relativePath: string,
    title: string,
    options?: RenameNoteOptions,
  ): Promise<RepositoryResult<Note>>;
  deleteNote(relativePath: string): Promise<RepositoryResult<TrashEntry>>;
  createFolder(name: string, parent?: string | null): Promise<RepositoryResult<Folder>>;
  renameFolder(relativePath: string, name: string): Promise<RepositoryResult<Folder>>;
  deleteFolder(relativePath: string): Promise<RepositoryResult<TrashEntry>>;
}
