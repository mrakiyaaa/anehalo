import { FileSystemNoteRepository } from '@/features/storage/FileSystemNoteRepository';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { invoke } from '@tauri-apps/api/core';
import { createSnippet } from './note-snippet';
import { parentPath, pathName, validateRelativePath } from './storage-paths';
import {
  success,
  failure,
  describeStorageError,
  storageFailure,
  type RepositoryResult,
} from './repository-result';
import type { Note, NoteSummary, VaultTree } from '@/types/notes';
import { compareNoteRecency } from './note-order';
import { compareFolderPaths } from './folder-order';
import { ScanBudget } from './ScanBudget';
import { defaultScanLimits, scanLimitMessage, type ScanLimits } from './ScanLimits';
import { openVaultAccess } from './open-vault-access';
import { SearchTextProcessor } from '@/features/search/SearchTextProcessor';
import { prepareNotePreview } from './prepare-note-preview';

interface VaultSnapshot {
  readonly entryCount?: number;
  readonly folders: readonly string[];
  readonly notes: readonly { relativePath: string; content: string; modifiedAt: number }[];
}

export class TauriNoteRepository extends FileSystemNoteRepository {
  private snapshotNotes = new Map<string, Note>();
  private hydration: Promise<RepositoryResult<VaultTree>> | null = null;
  private snapshotGeneration = 0;

  constructor(private readonly resolvedVaultPath: string) {
    super(new TauriVaultFileSystem(() => openVaultAccess(resolvedVaultPath), false));
  }

  override async listTree(
    limits: ScanLimits = defaultScanLimits,
  ): Promise<RepositoryResult<VaultTree>> {
    const generation = ++this.snapshotGeneration;
    this.hydration = null;
    const budget = new ScanBudget(limits);
    try {
      const recordStartup = performance.getEntriesByName('anehalo:vault-read-start').length === 0;
      if (recordStartup) performance.mark('anehalo:vault-read-start');
      const snapshot = await budget.wait(
        invoke<VaultSnapshot>('read_vault_snapshot', {
          vaultPath: this.resolvedVaultPath,
          includeContent: false,
          limits: {
            ...budget.limits,
            maximumDurationMilliseconds: Math.max(1, Math.floor(budget.remainingMilliseconds)),
          },
        }),
      );
      if (recordStartup) performance.mark('anehalo:vault-read-end');
      const { tree } = await this.prepareSnapshot(snapshot, true, budget);
      if (generation === this.snapshotGeneration)
        this.hydration = this.hydrateSnapshot(
          generation,
          new ScanBudget({
            ...budget.limits,
            maximumDurationMilliseconds: budget.remainingMilliseconds,
          }),
        );
      return success(tree);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not load the vault.'));
    }
  }

  private async prepareSnapshot(
    snapshot: VaultSnapshot,
    reuseCachedContent: boolean,
    budget: ScanBudget,
  ) {
    const processor = new SearchTextProcessor();
    try {
      if (
        (snapshot.entryCount ?? snapshot.notes.length + snapshot.folders.length) >
        budget.limits.maximumEntries
      )
        storageFailure('scan-limit', scanLimitMessage);
      const notes: Note[] = [];
      for (const entry of snapshot.notes) {
        await budget.entry();
        validateRelativePath(entry.relativePath);
        const cached = this.snapshotNotes.get(entry.relativePath);
        const content =
          reuseCachedContent && cached?.modifiedAt === entry.modifiedAt
            ? cached.content
            : entry.content;
        const searchText = await prepareNotePreview(content, processor, budget);
        notes.push({
          ...entry,
          content,
          title: pathName(entry.relativePath).replace(/\.md$/i, ''),
          folder: parentPath(entry.relativePath) || null,
          searchText,
          snippet: createSnippet(searchText),
        });
      }
      notes.sort(compareNoteRecency);
      const folders: VaultTree['folders'][number][] = [];
      for (const relativePath of snapshot.folders) {
        await budget.entry();
        folders.push({
          relativePath: validateRelativePath(relativePath),
          name: pathName(relativePath),
          parent: parentPath(relativePath) || null,
        });
      }
      folders.sort(compareFolderPaths);
      budget.check();
      const tree: VaultTree = {
        vaultPath: this.resolvedVaultPath,
        folders,
        notes: notes.map(({ title, folder, relativePath, modifiedAt, snippet, searchText }) => ({
          title,
          folder,
          relativePath,
          modifiedAt,
          snippet,
          searchText,
        })),
      };
      return { notes, tree };
    } finally {
      processor.cancel();
    }
  }

  private async hydrateSnapshot(
    generation: number,
    budget: ScanBudget,
  ): Promise<RepositoryResult<VaultTree>> {
    try {
      const snapshot = await budget.wait(
        invoke<VaultSnapshot>('read_vault_snapshot', {
          vaultPath: this.resolvedVaultPath,
          includeContent: true,
          limits: {
            ...budget.limits,
            maximumDurationMilliseconds: Math.max(1, Math.floor(budget.remainingMilliseconds)),
          },
        }),
      );
      const { notes, tree } = await this.prepareSnapshot(snapshot, false, budget);
      if (generation === this.snapshotGeneration)
        this.snapshotNotes = new Map(notes.map((note) => [note.relativePath, note]));
      return success(tree);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not load the vault.'));
    }
  }

  async hydrateTree(): Promise<RepositoryResult<VaultTree>> {
    if (this.hydration) return this.hydration;
    const tree = await this.listTree();
    return this.hydration ?? tree;
  }

  async readSnapshotNote(
    relativePath: string,
    expectedSummary?: NoteSummary,
  ): Promise<RepositoryResult<Note>> {
    if (this.hydration) {
      const hydrated = await this.hydration;
      if (!hydrated.ok) return hydrated;
    }
    const note = this.snapshotNotes.get(relativePath);
    const current =
      note &&
      (!expectedSummary ||
        (note.modifiedAt === expectedSummary.modifiedAt &&
          note.searchText === expectedSummary.searchText));
    return current ? success(note) : this.readNote(relativePath);
  }
}
