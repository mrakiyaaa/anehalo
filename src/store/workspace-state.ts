import type { Folder, Note, VaultTree } from '@/types/notes';
import type { NoteRepository, TrashEntry } from '@/features/storage/NoteRepository';
import type { RepositoryError, RepositoryResult } from '@/features/storage/repository-result';
import type { NoteDraft } from '@/features/editor/NoteDraft';

export interface WorkspaceOptions {
  readonly lastOpenedNotePath?: string | null;
  readonly reopenLastNote?: boolean;
  readonly rememberNote?: (path: string | null) => Promise<void>;
}

export interface WorkspaceState {
  tree: VaultTree;
  activeFolderPath: string | null;
  searchText: string;
  isLoading: boolean;
  isMutating: boolean;
  isClosing: boolean;
  error: RepositoryError | null;
  view: 'home' | 'editor';
  openDraft: NoteDraft | null;
  pendingDrafts: readonly NoteDraft[];
  isOpeningNote: boolean;
  openingError: RepositoryError | null;
  selectFolder: (folder: string | null) => void;
  setSearchText: (searchText: string) => void;
  dismissError: () => void;
  reportError: (error: RepositoryError) => void;
  refreshTree: () => ReturnType<NoteRepository['listTree']>;
  initialize: () => Promise<void>;
  openNote: (path: string) => Promise<RepositoryResult<void>>;
  goHome: () => Promise<RepositoryResult<void>>;
  startQuickNote: (content?: string) => Promise<RepositoryResult<Note>>;
  updateNoteContent: (identifier: string, content: string) => void;
  updateNoteTitle: (identifier: string, title: string) => void;
  reportContentError: (identifier: string, error: RepositoryError) => void;
  saveNote: (identifier: string) => Promise<RepositoryResult<void>>;
  saveNoteContent: (identifier: string) => Promise<RepositoryResult<void>>;
  flushNotes: () => Promise<RepositoryResult<void>>;
  checkOpenNote: () => Promise<RepositoryResult<void>>;
  resolveConflict: (choice: 'mine' | 'theirs') => Promise<RepositoryResult<void>>;
  recoverNote: () => Promise<RepositoryResult<void>>;
  setClosing: (isClosing: boolean) => void;
  pauseAutoSave: () => void;
  resumeAutoSave: () => void;
  createFolder: (name: string) => Promise<RepositoryResult<Folder>>;
  renameFolder: (path: string, name: string) => Promise<RepositoryResult<Folder>>;
  deleteFolder: (path: string) => Promise<RepositoryResult<TrashEntry>>;
  renameNote: (path: string, name: string) => Promise<RepositoryResult<Note>>;
  deleteNote: (path: string) => Promise<RepositoryResult<TrashEntry>>;
}
