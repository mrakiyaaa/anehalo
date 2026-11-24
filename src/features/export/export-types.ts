import type { JSONContent } from '@tiptap/core';
import type { RepositoryResult } from '@/features/storage/repository-result';

export type ExportAction = 'copy-markdown' | 'copy-rich-text' | 'save-markdown' | 'save-pdf';
export interface ExportSource {
  readonly title: string;
  readonly relativePath: string;
  readonly content: string;
}
export interface ExportDocument {
  readonly title: string;
  readonly relativePath: string;
  readonly document: JSONContent;
}
export interface ExportAsset {
  readonly name: string;
  readonly bytes: Uint8Array;
}
export interface ExportImage extends ExportAsset {
  readonly mimeType: string;
}
export interface ExportBundle {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly assets: readonly ExportAsset[];
}
export interface ExportProgress {
  readonly path: string;
  readonly message: string;
  /** Null while the work has no measurable progress. */
  readonly fraction: number | null;
}
export interface ExportOutcome {
  readonly status: 'cancelled' | 'copied' | 'saved';
  readonly message?: string;
  readonly path?: string;
  readonly warning?: string;
}
/** Notes save as Markdown or PDF; diagrams as an image or a .excalidraw copy. */
export type ExportExtension = 'md' | 'pdf' | 'png' | 'svg' | 'excalidraw';
export interface ExportPlatform {
  chooseDestination(
    fileName: string,
    extension: ExportExtension,
    lastFolder: string | null,
  ): Promise<RepositoryResult<string | null>>;
  writeBundle(bundle: ExportBundle): Promise<RepositoryResult<void>>;
  writeClipboard(text: string, html?: string): Promise<RepositoryResult<void>>;
  writeClipboardImage(png: Uint8Array): Promise<RepositoryResult<void>>;
  loadImage(notePath: string, reference: string): Promise<RepositoryResult<ExportImage>>;
  revealFile(path: string): Promise<RepositoryResult<void>>;
}
