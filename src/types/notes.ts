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

export type VaultItemKind = 'note' | 'diagram';

/** Diagrams are listed by name and time only; their content is read when one is opened. */
export interface DiagramSummary {
  readonly kind: 'diagram';
  readonly title: string;
  readonly folder: string | null;
  readonly relativePath: string;
  readonly modifiedAt: number;
}

export interface VaultTree {
  readonly vaultPath: string;
  readonly folders: readonly Folder[];
  readonly notes: readonly NoteSummary[];
  readonly diagrams: readonly DiagramSummary[];
}
