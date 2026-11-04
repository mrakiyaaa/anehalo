export type PastelTone = 'sky' | 'mint' | 'peach' | 'lilac' | 'butter' | 'rose';

export interface Folder {
  readonly id: string;
  readonly name: string;
  readonly tone: PastelTone;
}

export interface Note {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly folderId: string;
  readonly editedLabel: string;
  readonly linkedNoteTitle?: string;
}
