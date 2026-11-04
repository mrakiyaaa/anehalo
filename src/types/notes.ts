export type PastelTone = 'sky' | 'mint' | 'peach' | 'lilac' | 'butter' | 'rose';

export interface Folder {
  readonly name: string;
  readonly relativePath: string;
  readonly parent: string | null;
}

export interface NoteSummary {
  readonly title: string;
  readonly folder: string | null;
  readonly relativePath: string;
  readonly modifiedAt: number;
  readonly snippet: string;
  readonly searchText: string;
}

export interface Note extends NoteSummary {
  readonly content: string;
}

export interface VaultTree {
  readonly vaultPath: string;
  readonly folders: readonly Folder[];
  readonly notes: readonly NoteSummary[];
}
