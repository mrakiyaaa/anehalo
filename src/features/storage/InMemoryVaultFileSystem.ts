import { storageFailure } from '@/features/storage/repository-result';
import {
  isInsideFolder,
  parentPath,
  pathName,
  validateRelativePath,
} from '@/features/storage/storage-paths';
import type {
  VaultEntry,
  VaultFileSystem,
  VaultMetadata,
} from '@/features/storage/VaultFileSystem';

export interface MemoryEntry {
  readonly relativePath: string;
  readonly type: VaultEntry['type'];
  readonly content?: string;
  readonly modifiedAt?: number;
}

interface StoredEntry extends VaultMetadata {
  readonly content: string;
}

type MemoryOperation = 'write' | 'rename' | 'remove';

export class InMemoryVaultFileSystem implements VaultFileSystem {
  private readonly entries = new Map<string, StoredEntry>();
  private pendingFailure: { operation: MemoryOperation; message: string } | null = null;
  readonly operations: { operation: string; path: string; destination?: string }[] = [];

  constructor(
    seed: readonly MemoryEntry[] = [],
    private readonly now: () => number = Date.now,
  ) {
    this.entries.set('', { type: 'directory', content: '', modifiedAt: this.now() });
    for (const entry of seed) {
      validateRelativePath(entry.relativePath, false, true);
      let directory = parentPath(entry.relativePath);
      while (directory) {
        this.entries.set(directory, { type: 'directory', content: '', modifiedAt: this.now() });
        directory = parentPath(directory);
      }
      this.entries.set(entry.relativePath, {
        type: entry.type,
        content: entry.content ?? '',
        modifiedAt: entry.modifiedAt ?? this.now(),
      });
    }
  }

  initialize(): Promise<string> {
    return Promise.resolve('Memory/Anehalo');
  }

  private key(path: string): string | undefined {
    validateRelativePath(path, true, true);
    return [...this.entries.keys()].find((entry) => entry.toLowerCase() === path.toLowerCase());
  }

  private require(path: string, type?: 'file' | 'directory'): StoredEntry {
    const components = path.split('/');
    for (let index = 1; index <= components.length; index += 1) {
      const ancestor = this.entries.get(this.key(components.slice(0, index).join('/')) ?? '\u0000');
      if (ancestor?.type === 'link')
        storageFailure('invalid-path', 'Symbolic links are not supported.');
    }
    const entry = this.entries.get(this.key(path) ?? '\u0000');
    if (!entry) storageFailure('not-found', 'The file or folder no longer exists.');
    if (type && entry.type !== type)
      storageFailure('invalid-type', 'The path has the wrong file type.');
    return entry;
  }

  metadata(path: string): Promise<VaultMetadata | null> {
    const entry = this.entries.get(this.key(path) ?? '\u0000');
    if (!entry) return Promise.resolve(null);
    this.require(path);
    return Promise.resolve({ type: entry.type, modifiedAt: entry.modifiedAt });
  }

  readDirectory(path: string): Promise<readonly VaultEntry[]> {
    this.require(path, 'directory');
    const entries = [...this.entries].filter(
      ([entry]) => entry !== '' && parentPath(entry).toLowerCase() === path.toLowerCase(),
    );
    return Promise.resolve(
      entries.map(([entry, metadata]) => ({ name: pathName(entry), type: metadata.type })),
    );
  }

  readText(path: string): Promise<string> {
    return Promise.resolve(this.require(path, 'file').content);
  }

  failNext(operation: MemoryOperation, message = 'Simulated disk failure'): void {
    this.pendingFailure = { operation, message };
  }

  private checkFailure(operation: MemoryOperation): void {
    if (this.pendingFailure?.operation !== operation) return;
    const message = this.pendingFailure.message;
    this.pendingFailure = null;
    storageFailure('io-error', message);
  }

  writeText(path: string, content: string): Promise<void> {
    this.checkFailure('write');
    this.require(parentPath(path), 'directory');
    if (this.key(path) !== undefined) storageFailure('already-exists', 'The file already exists.');
    this.operations.push({ operation: 'write', path });
    this.entries.set(path, { type: 'file', content, modifiedAt: this.now() });
    return Promise.resolve();
  }

  createDirectory(path: string): Promise<void> {
    this.require(parentPath(path), 'directory');
    if (this.key(path) !== undefined)
      storageFailure('already-exists', 'The folder already exists.');
    this.entries.set(path, { type: 'directory', content: '', modifiedAt: this.now() });
    return Promise.resolve();
  }

  rename(source: string, destination: string): Promise<void> {
    this.checkFailure('rename');
    const entry = this.require(source);
    this.require(parentPath(destination), 'directory');
    const sourceKey = this.key(source);
    if (sourceKey === undefined) storageFailure('not-found', 'The source no longer exists.');
    const existingDestination = this.key(destination);
    if (
      existingDestination !== undefined &&
      existingDestination !== sourceKey &&
      (entry.type === 'directory' || this.require(existingDestination).type !== 'file')
    )
      storageFailure('already-exists', 'The destination exists.');
    if (entry.type === 'directory' && destination.startsWith(`${source}/`))
      storageFailure('invalid-path', 'A folder cannot be moved inside itself.');
    const moved = [...this.entries].filter(([path]) => isInsideFolder(path, sourceKey));
    for (const [path] of moved) this.entries.delete(path);
    if (existingDestination !== undefined) this.entries.delete(existingDestination);
    for (const [path, metadata] of moved)
      this.entries.set(`${destination}${path.slice(sourceKey.length)}`, metadata);
    this.operations.push({ operation: 'rename', path: source, destination });
    return Promise.resolve();
  }

  removeTemporaryFile(path: string): Promise<void> {
    this.checkFailure('remove');
    if (!/^\.anehalo-[\w-]+\.tmp$/.test(pathName(path)))
      storageFailure('invalid-path', 'Only temporary files may be permanently removed.');
    this.require(path, 'file');
    this.entries.delete(this.key(path) ?? path);
    this.operations.push({ operation: 'remove', path });
    return Promise.resolve();
  }

  snapshot(): readonly MemoryEntry[] {
    return [...this.entries]
      .filter(([path]) => path !== '')
      .map(([relativePath, entry]) => ({ relativePath, ...entry }));
  }
}
