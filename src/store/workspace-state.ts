import type { DiagramSummary, Folder, Note, VaultTree } from '@/types/notes';
import type { ImportCandidate, ImportReport } from '@/features/diagram-import/DiagramImportService';
import type { DiagramDraft } from '@/features/diagrams/DiagramAutoSaver';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import type { DiagramCodec } from '@/features/diagrams/DiagramRepository';
import type { ThumbnailFiles } from '@/features/thumbnails/thumbnail-files';
import type { ThumbnailService } from '@/features/thumbnails/thumbnail-service';
import type { NoteRepository, TrashEntry } from '@/features/storage/NoteRepository';
import type { RepositoryError, RepositoryResult } from '@/features/storage/repository-result';
import type { NoteDraft } from '@/features/editor/NoteDraft';
import type { LinkIndexSnapshot } from '@/features/note-links/NoteLinkIndex';
import type { createNavigationHistory } from '@/store/navigation-history';
import type { ScanLimits } from '@/features/storage/ScanLimits';

export interface WorkspaceOptions {
  readonly vaultPath?: string;
  readonly scanLimits?: ScanLimits;
  readonly lastOpenedNotePath?: string | null;
  readonly reopenLastNote?: boolean;
  readonly rememberNote?: (path: string | null) => Promise<void>;
  /** Replaces Excalidraw's serializer, so store tests do not load Excalidraw. */
  readonly diagramCodec?: () => Promise<DiagramCodec>;
  /** Where diagram thumbnails are cached; without it Home shows placeholders. */
  readonly thumbnailFiles?: ThumbnailFiles;
}

export interface WorkspaceState {
  tree: VaultTree;
  links: LinkIndexSnapshot;
  navigation: ReturnType<typeof createNavigationHistory>;
  navigateHistory: (direction: -1 | 1) => Promise<RepositoryResult<void>>;
  createLinkedNote: (title: string, folder: string | null) => Promise<RepositoryResult<Note>>;
  restoreLinkedNote: (path: string) => Promise<RepositoryResult<Note>>;
  activeFolderPath: string | null;
  searchText: string;
  searchIndex: import('@/features/search/SearchIndex').SearchIndex;
  searchRevision: number;
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  isLoading: boolean;
  isMutating: boolean;
  isClosing: boolean;
  error: RepositoryError | null;
  vaultError: RepositoryError | null;
  view: 'home' | 'editor' | 'diagram';
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
  /** Opens a note or a diagram, decided by the file's extension. */
  openItem: (path: string) => Promise<RepositoryResult<void>>;
  goHome: () => Promise<RepositoryResult<void>>;
  startQuickNote: (content?: string) => Promise<RepositoryResult<Note>>;
  updateNoteContent: (identifier: string, content: string) => void;
  /** Records title-field typing without renaming; see NoteAutoSaver.editTitle. */
  editNoteTitle: (identifier: string, title: string) => void;
  /** Renames once for the typed title. Resolves to the title the note ended up with. */
  commitNoteTitle: (identifier: string, title: string) => Promise<RepositoryResult<string>>;
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
  /** Thumbnails for diagram cards; null when there is no cache. */
  thumbnails: ThumbnailService | null;
  /** False when the vault's storage cannot hold diagrams (for example a test double). */
  diagramsAvailable: boolean;
  /** The open diagram, saved by its own auto-saver. */
  diagram: DiagramDraft | null;
  isOpeningDiagram: boolean;
  /** A search match to show once that diagram's canvas is ready; cleared once shown. */
  elementFocus: { readonly path: string; readonly elementId: string } | null;
  /** Opens a search result: a diagram content match also brings its element into view. */
  openSearchResult: (path: string, elementId: string | null) => Promise<RepositoryResult<void>>;
  clearElementFocus: () => void;
  /** Why the last diagram could not be opened; the file was left untouched. */
  diagramOpenError: RepositoryError | null;
  /** Creates "Untitled diagram" in the given folder (the selected one by default) and opens it. */
  newDiagram: (folder?: string | null) => Promise<RepositoryResult<void>>;
  openDiagramFile: (path: string) => Promise<RepositoryResult<void>>;
  /** Called only for real document changes; see diagram-fingerprint.ts. */
  updateDiagram: (scene: DiagramScene) => void;
  saveDiagram: () => Promise<RepositoryResult<void>>;
  checkOpenDiagram: () => Promise<RepositoryResult<void>>;
  resolveDiagramConflict: (choice: 'mine' | 'theirs') => Promise<RepositoryResult<void>>;
  trashDiagram: (path: string) => Promise<RepositoryResult<TrashEntry>>;
  /** Creates "Untitled diagram" in a folder without opening it (embedding from a note). */
  createDiagramFile: (folder: string | null) => Promise<RepositoryResult<DiagramSummary>>;
  isDiagramInTrash: (path: string) => Promise<RepositoryResult<boolean>>;
  restoreDiagram: (path: string) => Promise<RepositoryResult<DiagramSummary>>;
  /** A diagram as a PNG for exports; loads Excalidraw, so only while exporting. */
  renderDiagramImage: (
    path: string,
  ) => Promise<RepositoryResult<import('@/features/export/export-types').ExportImage>>;
  /**
   * Copies diagram files into a folder (the vault root for null) and refreshes the list. Files
   * that cannot be imported are reported in the result, never written. One imported file opens.
   */
  importDiagramFiles: (
    candidates: readonly ImportCandidate[],
    folder: string | null,
    confirmLarge: (candidate: ImportCandidate) => Promise<boolean>,
  ) => Promise<RepositoryResult<ImportReport>>;
  renameDiagram: (path: string, title: string) => Promise<RepositoryResult<DiagramSummary>>;
  moveDiagram: (path: string, folder: string | null) => Promise<RepositoryResult<DiagramSummary>>;
}
