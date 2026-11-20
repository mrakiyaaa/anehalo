export interface VaultEntry {
  readonly name: string;
  readonly type: 'file' | 'directory' | 'link';
}

export interface VaultMetadata {
  readonly type: VaultEntry['type'];
  readonly modifiedAt: number;
  /** In bytes; 0 for directories. */
  readonly size: number;
}

export interface VaultFileSystem {
  initialize(): Promise<string>;
  metadata(relativePath: string): Promise<VaultMetadata | null>;
  readDirectory(relativePath: string, maximumEntries?: number): Promise<readonly VaultEntry[]>;
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, content: string): Promise<void>;
  createDirectory(relativePath: string): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  removeTemporaryFile(relativePath: string): Promise<void>;
}
