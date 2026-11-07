import { FileSystemNoteRepository } from '@/features/storage/FileSystemNoteRepository';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { invoke } from '@tauri-apps/api/core';
import { createSnippet, markdownToPlainText } from './note-snippet';
import { parentPath, pathName, validateRelativePath } from './storage-paths';
import { success, failure, describeStorageError, type RepositoryResult } from './repository-result';
import type { Note, NoteSummary, VaultTree } from '@/types/notes';
import { compareNoteRecency } from './note-order';

interface VaultSnapshot {
  readonly folders: readonly string[];
  readonly notes: readonly { relativePath: string; content: string; modifiedAt: number }[];
}

export class TauriNoteRepository extends FileSystemNoteRepository {
  private snapshotNotes = new Map<string, Note>();
  private hydration: Promise<RepositoryResult<VaultTree>> | null = null;
  private snapshotGeneration = 0;

  constructor(private readonly resolvedVaultPath: string) {
    super(new TauriVaultFileSystem(() => Promise.resolve(resolvedVaultPath), false));
  }

  override async listTree(): Promise<RepositoryResult<VaultTree>> {
    const generation = ++this.snapshotGeneration;
    this.hydration = null;
    try {
      const recordStartup = performance.getEntriesByName('anehalo:vault-read-start').length === 0;
      if (recordStartup) performance.mark('anehalo:vault-read-start');
      const snapshot = await invoke<VaultSnapshot>('read_vault_snapshot', {
        vaultPath: this.resolvedVaultPath,
        includeContent: false,
      });
      if (recordStartup) performance.mark('anehalo:vault-read-end');
      const { tree } = this.prepareSnapshot(snapshot, true);
      if (generation === this.snapshotGeneration) this.hydration = this.hydrateSnapshot(generation);
      return success(tree);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not load the vault.'));
    }
  }

  private prepareSnapshot(snapshot: VaultSnapshot, reuseCachedContent: boolean) {
    const notes = snapshot.notes
      .map((entry): Note => {
        validateRelativePath(entry.relativePath);
        const cached = this.snapshotNotes.get(entry.relativePath);
        const content =
          reuseCachedContent && cached?.modifiedAt === entry.modifiedAt
            ? cached.content
            : entry.content;
        const searchText = markdownToPlainText(content);
        return {
          ...entry,
          content,
          title: pathName(entry.relativePath).replace(/\.md$/i, ''),
          folder: parentPath(entry.relativePath) || null,
          searchText,
          snippet: createSnippet(searchText),
        };
      })
      .sort(compareNoteRecency);
    const tree: VaultTree = {
      vaultPath: this.resolvedVaultPath,
      folders: [...snapshot.folders]
        .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }))
        .map((relativePath) => ({
          relativePath: validateRelativePath(relativePath),
          name: pathName(relativePath),
          parent: parentPath(relativePath) || null,
        })),
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
  }

  private async hydrateSnapshot(generation: number): Promise<RepositoryResult<VaultTree>> {
    try {
      const snapshot = await invoke<VaultSnapshot>('read_vault_snapshot', {
        vaultPath: this.resolvedVaultPath,
        includeContent: true,
      });
      const { notes, tree } = this.prepareSnapshot(snapshot, false);
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
