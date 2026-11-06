import type {
  NoteRepository,
  CreateNoteInput,
  RenameNoteOptions,
} from '@/features/storage/NoteRepository';
import type { SearchIndex } from './SearchIndex';

export class IndexedNoteRepository implements NoteRepository {
  constructor(
    private readonly repository: NoteRepository,
    private readonly index: SearchIndex,
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
  async renameNote(path: string, title: string, options?: RenameNoteOptions) {
    const result = await this.repository.renameNote(path, title, options);
    if (result.ok) {
      this.index.remove(path);
      this.index.update(result.value);
    }
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
  async renameFolder(path: string, name: string) {
    const result = await this.repository.renameFolder(path, name);
    if (result.ok && result.value.relativePath !== path)
      this.index.relocateFolder(path, result.value.relativePath);
    return result;
  }
}
