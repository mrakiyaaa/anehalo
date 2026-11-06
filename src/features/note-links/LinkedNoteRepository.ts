import type {
  NoteRepository,
  CreateNoteInput,
  RenameNoteOptions,
} from '@/features/storage/NoteRepository';
import type { Note } from '@/types/notes';
import { success, type RepositoryError } from '@/features/storage/repository-result';
import { NoteLinkIndex } from './NoteLinkIndex';
import { rewriteNoteLinks, type LinkRename } from './NoteLinkRewriter';
import { isInsideFolder } from '@/features/storage/storage-paths';

export class LinkedNoteRepository implements NoteRepository {
  constructor(
    private readonly repository: NoteRepository,
    readonly index: NoteLinkIndex,
    private readonly renamed: (rename: LinkRename, notes: ReadonlyMap<string, Note>) => void,
    private readonly report: (error: RepositoryError) => void,
  ) {}
  initializeVault() {
    return this.repository.initializeVault();
  }
  listTree() {
    return this.repository.listTree();
  }
  readNote(path: string) {
    return this.repository.readNote(path);
  }
  createFolder(name: string, parent?: string | null) {
    return this.repository.createFolder(name, parent);
  }
  async writeNote(path: string, content: string) {
    const result = await this.repository.writeNote(path, content);
    if (result.ok) this.index.update(result.value);
    return result;
  }
  async createNote(input?: CreateNoteInput) {
    const result = await this.repository.createNote(input);
    if (result.ok) this.index.update(result.value);
    return result;
  }
  async deleteNote(path: string) {
    const result = await this.repository.deleteNote(path);
    if (result.ok) this.index.remove(path);
    return result;
  }
  async deleteFolder(path: string) {
    const result = await this.repository.deleteFolder(path);
    if (result.ok) this.index.remove(path);
    return result;
  }
  private async rewrite(rename: LinkRename) {
    const updated = new Map<string, Note>();
    const tree = await this.repository.listTree();
    const errors: string[] = [];
    const indexed: Note[] = [];
    this.index.remove(rename.previousPath);
    if (!tree.ok) errors.push(tree.error.message);
    else
      for (const summary of tree.value.notes) {
        const read = await this.repository.readNote(summary.relativePath);
        if (!read.ok) {
          errors.push(`${summary.title}: ${read.error.message}`);
          continue;
        }
        const content = rewriteNoteLinks(read.value.content, rename);
        const result =
          content === read.value.content
            ? read
            : await this.repository.writeNote(summary.relativePath, content);
        if (result.ok) {
          if (
            content !== read.value.content ||
            (rename.folder
              ? isInsideFolder(summary.relativePath, rename.nextPath)
              : summary.relativePath === rename.nextPath)
          )
            updated.set(summary.relativePath, result.value);
          indexed.push(result.value);
        } else errors.push(`${summary.title}: ${result.error.message}`);
      }
    this.index.updateMany(indexed);
    this.renamed(rename, updated);
    if (errors.length)
      this.report({
        code: 'io-error',
        message: `The rename succeeded, but links could not be updated in ${errors.length} note(s).`,
        detail: errors.join('\n'),
      });
    return updated;
  }
  async renameNote(path: string, title: string, options?: RenameNoteOptions) {
    const result = await this.repository.renameNote(path, title, options);
    if (!result.ok || result.value.relativePath === path) return result;
    const updated = await this.rewrite({ previousPath: path, nextPath: result.value.relativePath });
    return success(updated.get(result.value.relativePath) ?? result.value);
  }
  async renameFolder(path: string, name: string) {
    const result = await this.repository.renameFolder(path, name);
    if (result.ok && result.value.relativePath !== path)
      await this.rewrite({ previousPath: path, nextPath: result.value.relativePath, folder: true });
    return result;
  }
}
