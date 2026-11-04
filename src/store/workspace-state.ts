import type { Folder, Note, VaultTree } from '@/types/notes';
import type { NoteRepository, TrashEntry } from '@/features/storage/NoteRepository';
import type { RepositoryError, RepositoryResult } from '@/features/storage/repository-result';
import type { CaptureState } from '@/store/capture-state';

export interface WorkspaceState {
  tree: VaultTree;
  activeFolderPath: string | null;
  searchText: string;
  isLoading: boolean;
  isMutating: boolean;
  isCreatingNote: boolean;
  error: RepositoryError | null;
  capture: CaptureState;
  selectFolder: (folder: string | null) => void;
  setSearchText: (searchText: string) => void;
  dismissError: () => void;
  reportError: (error: RepositoryError) => void;
  refreshTree: () => ReturnType<NoteRepository['listTree']>;
  updateCaptureDraft: (draft: string) => void;
  saveCapture: () => Promise<RepositoryResult<Note | null>>;
  startQuickNote: () => Promise<RepositoryResult<Note>>;
  createFolder: (name: string) => Promise<RepositoryResult<Folder>>;
  renameFolder: (path: string, name: string) => Promise<RepositoryResult<Folder>>;
  deleteFolder: (path: string) => Promise<RepositoryResult<TrashEntry>>;
  renameNote: (path: string, name: string) => Promise<RepositoryResult<Note>>;
  deleteNote: (path: string) => Promise<RepositoryResult<TrashEntry>>;
}
