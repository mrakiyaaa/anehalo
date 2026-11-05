import type {
  CreateNoteInput,
  NoteRepository,
  TrashEntry,
  RenameNoteOptions,
} from '@/features/storage/NoteRepository';
import { noteTitle, sanitizeName, uniqueName } from '@/features/storage/note-names';
import { createSnippet, markdownToPlainText } from '@/features/storage/note-snippet';
import {
  describeStorageError,
  failure,
  storageFailure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import {
  joinRelativePath,
  parentPath,
  pathName,
  validateRelativePath,
} from '@/features/storage/storage-paths';
import { VaultFileService } from '@/features/storage/VaultFileService';
import type { VaultFileSystem } from '@/features/storage/VaultFileSystem';
import type { Folder, Note, NoteSummary, VaultTree } from '@/types/notes';

const initializationMarker = '.anehalo-initialized';
const welcomeContent =
  '# Welcome to Anehalo\n\nYour notes are plain Markdown files in your chosen notes folder.\n\n- Use Quick note to capture a thought.\n- Create folders to keep your notes organized.\n- Rename notes and folders from their actions menu.\n- Deleted items can be recovered from the hidden .trash directory in your vault.\n\nYour files stay on your computer.\n';

export class FileSystemNoteRepository implements NoteRepository {
  private readonly files: VaultFileService;
  private queue: Promise<void> = Promise.resolve();
  private initialized = false;
  private vaultPath = '';

  constructor(fileSystem: VaultFileSystem) {
    this.files = new VaultFileService(fileSystem);
  }

  private run<Value>(
    action: string,
    operation: () => Promise<Value>,
  ): Promise<RepositoryResult<Value>> {
    const result = this.queue.then(async (): Promise<RepositoryResult<Value>> => {
      try {
        await this.initialize();
        return success(await operation());
      } catch (error) {
        return failure(describeStorageError(error, action));
      }
    });
    this.queue = result.then(() => undefined);
    return result;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.vaultPath = await this.files.fileSystem.initialize();
    this.initialized = true;
  }

  initializeVault(): Promise<RepositoryResult<void>> {
    return this.run('Could not prepare your notes folder.', async () => {
      const marker = await this.files.fileSystem.metadata(initializationMarker);
      if (marker && marker.type !== 'file')
        storageFailure('invalid-type', 'The vault initialization marker is not a regular file.');
      if (!marker) {
        const entries = await this.files.fileSystem.readDirectory('');
        const unfinishedStarterFolder =
          entries.length === 1 &&
          entries[0]?.name === 'Getting started' &&
          entries[0].type === 'directory' &&
          (await this.files.fileSystem.readDirectory('Getting started')).length === 0;
        if (entries.length === 0 || unfinishedStarterFolder) {
          await this.files.ensureDirectory('Getting started');
          await this.files.atomicWrite('Getting started/Welcome.md', welcomeContent);
        }
        await this.files.atomicWrite(initializationMarker, 'Anehalo vault initialized.\n');
      }
    });
  }

  private validateNote(path: string): string {
    validateRelativePath(path);
    if (!/\.md$/i.test(path)) storageFailure('invalid-path', 'Notes must have a .md extension.');
    return path;
  }

  private async loadNoteData(path: string): Promise<{ summary: NoteSummary; content: string }> {
    const metadata = await this.files.requireEntry(path, 'file');
    const content = await this.files.fileSystem.readText(path);
    const searchText = markdownToPlainText(content);
    const summary: NoteSummary = {
      relativePath: path,
      title: pathName(path).replace(/\.md$/i, ''),
      folder: parentPath(path) || null,
      modifiedAt: metadata.modifiedAt,
      snippet: createSnippet(searchText),
      searchText,
    };
    return { summary, content };
  }

  private async loadNote(path: string): Promise<Note> {
    const data = await this.loadNoteData(path);
    return { ...data.summary, content: data.content };
  }

  listTree(): Promise<RepositoryResult<VaultTree>> {
    return this.run('Could not load the vault.', async () => {
      const folders: Folder[] = [];
      const notes: NoteSummary[] = [];
      const visitDirectory = async (directory: string): Promise<void> => {
        for (const entry of await this.files.fileSystem.readDirectory(directory)) {
          if (entry.name.startsWith('.') || entry.type === 'link') continue;
          const path = validateRelativePath(joinRelativePath(directory, entry.name));
          if (entry.type === 'directory') {
            folders.push({ name: entry.name, relativePath: path, parent: directory || null });
            await visitDirectory(path);
          } else if (/\.md$/i.test(entry.name)) {
            notes.push((await this.loadNoteData(path)).summary);
          }
        }
      };
      await visitDirectory('');
      folders.sort((first, second) =>
        first.relativePath.localeCompare(second.relativePath, undefined, { numeric: true }),
      );
      notes.sort(
        (first, second) =>
          second.modifiedAt - first.modifiedAt || first.title.localeCompare(second.title),
      );
      return { vaultPath: this.vaultPath, folders, notes };
    });
  }

  readNote(relativePath: string): Promise<RepositoryResult<Note>> {
    return this.run('Could not read the note.', () =>
      this.loadNote(this.validateNote(relativePath)),
    );
  }

  writeNote(relativePath: string, content: string): Promise<RepositoryResult<Note>> {
    return this.run('Could not save the note.', async () => {
      const path = this.validateNote(relativePath);
      await this.files.requireEntry(path, 'file');
      await this.files.atomicWrite(path, content);
      return this.loadNote(path);
    });
  }

  createNote(input: CreateNoteInput = {}): Promise<RepositoryResult<Note>> {
    return this.run('Could not create the note.', async () => {
      const folder = validateRelativePath(input.folder ?? '', true);
      await this.files.requireEntry(folder, 'directory');
      const entries = await this.files.fileSystem.readDirectory(folder);
      const name = uniqueName(
        noteTitle(input.title ?? 'Untitled note'),
        '.md',
        entries.map((entry) => entry.name),
      );
      const path = joinRelativePath(folder, name);
      await this.files.atomicWrite(path, input.content ?? '', false);
      return this.loadNote(path);
    });
  }

  renameNote(
    relativePath: string,
    title: string,
    options: RenameNoteOptions = {},
  ): Promise<RepositoryResult<Note>> {
    return this.run('Could not rename the note.', async () => {
      const source = this.validateNote(relativePath);
      await this.files.requireEntry(source, 'file');
      const directory = parentPath(source);
      const titleName = noteTitle(title);
      const destinationName = options.suffixDuplicates
        ? uniqueName(
            titleName,
            '.md',
            (await this.files.fileSystem.readDirectory(directory))
              .filter((entry) => entry.name.toLowerCase() !== pathName(source).toLowerCase())
              .map((entry) => entry.name),
          )
        : `${titleName}.md`;
      const destination = joinRelativePath(directory, destinationName);
      await this.files.ensureDestinationAvailable(source, destination);
      if (source !== destination) await this.files.fileSystem.rename(source, destination);
      return this.loadNote(destination);
    });
  }

  deleteNote(relativePath: string): Promise<RepositoryResult<TrashEntry>> {
    return this.run('Could not move the note to trash.', async () => {
      const path = this.validateNote(relativePath);
      await this.files.requireEntry(path, 'file');
      return this.files.moveToTrash(path);
    });
  }

  createFolder(name: string, parent: string | null = null): Promise<RepositoryResult<Folder>> {
    return this.run('Could not create the folder.', async () => {
      const directory = validateRelativePath(parent ?? '', true);
      await this.files.requireEntry(directory, 'directory');
      const entries = await this.files.fileSystem.readDirectory(directory);
      const uniqueFolderName = uniqueName(
        sanitizeName(name, 'Untitled folder'),
        '',
        entries.map((entry) => entry.name),
      );
      const path = joinRelativePath(directory, uniqueFolderName);
      await this.files.fileSystem.createDirectory(path);
      return { name: uniqueFolderName, relativePath: path, parent: directory || null };
    });
  }

  renameFolder(relativePath: string, name: string): Promise<RepositoryResult<Folder>> {
    return this.run('Could not rename the folder.', async () => {
      const source = validateRelativePath(relativePath);
      await this.files.requireEntry(source, 'directory');
      const folderName = sanitizeName(name, 'Untitled folder');
      const destination = joinRelativePath(parentPath(source), folderName);
      await this.files.ensureDestinationAvailable(source, destination);
      if (source !== destination) await this.files.fileSystem.rename(source, destination);
      return {
        name: folderName,
        relativePath: destination,
        parent: parentPath(destination) || null,
      };
    });
  }

  deleteFolder(relativePath: string): Promise<RepositoryResult<TrashEntry>> {
    return this.run('Could not move the folder to trash.', async () => {
      const path = validateRelativePath(relativePath);
      await this.files.requireEntry(path, 'directory');
      return this.files.moveToTrash(path);
    });
  }
}
