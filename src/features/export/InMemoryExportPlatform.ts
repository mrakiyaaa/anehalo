import { failure, success } from '@/features/storage/repository-result';
import type { ExportBundle, ExportExtension, ExportImage, ExportPlatform } from './export-types';

const clipboardFailure = failure({
  code: 'unavailable',
  message: 'The clipboard is busy or unavailable. Try again.',
});

export class InMemoryExportPlatform implements ExportPlatform {
  destination: string | null = null;
  failWrites = false;
  readonly bundles: ExportBundle[] = [];
  failClipboard = false;
  readonly clipboard: { text: string; html?: string }[] = [];
  readonly clipboardImages: Uint8Array[] = [];
  readonly dialogs: { fileName: string; extension: string; lastFolder: string | null }[] = [];
  readonly images = new Map<string, ExportImage>();
  chooseDestination(fileName: string, extension: ExportExtension, lastFolder: string | null) {
    this.dialogs.push({ fileName, extension, lastFolder });
    return Promise.resolve(success(this.destination));
  }
  writeBundle(bundle: ExportBundle) {
    if (this.failWrites)
      return Promise.resolve(
        failure({
          code: 'permission-denied',
          message: 'Could not save the file. Check that the folder is writable.',
        }),
      );
    this.bundles.push(bundle);
    return Promise.resolve(success(undefined));
  }
  writeClipboard(text: string, html?: string) {
    if (this.failClipboard) return Promise.resolve(clipboardFailure);
    this.clipboard.push({ text, ...(html !== undefined ? { html } : {}) });
    return Promise.resolve(success(undefined));
  }
  writeClipboardImage(png: Uint8Array) {
    if (this.failClipboard) return Promise.resolve(clipboardFailure);
    this.clipboardImages.push(png);
    return Promise.resolve(success(undefined));
  }
  loadImage(_notePath: string, reference: string) {
    const image = this.images.get(reference);
    return Promise.resolve(
      image
        ? success(image)
        : failure({ code: 'not-found', message: 'An image attachment is missing.' }),
    );
  }
  revealFile() {
    return Promise.resolve(success(undefined));
  }
}
