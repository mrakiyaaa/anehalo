import { invoke, isTauri } from '@tauri-apps/api/core';
import { downloadDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { writeHtml, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { describeStorageError, failure, success } from '@/features/storage/repository-result';
import { resolveAttachmentReference } from '@/features/attachments/attachment-paths';
import { imageExtension } from '@/features/attachments/image-validation';
import type { ExportBundle, ExportPlatform } from './export-types';
import { writeBrowserClipboard } from './browser-clipboard';

export class TauriExportPlatform implements ExportPlatform {
  constructor(private readonly vaultPath: string) {}
  async chooseDestination(fileName: string, extension: 'md' | 'pdf', lastFolder: string | null) {
    try {
      if (!isTauri())
        return failure({
          code: 'unavailable',
          message: 'Open the Anehalo desktop app to save exports.',
        });
      return success(
        await save({
          title: extension === 'pdf' ? 'Save as PDF' : 'Save as Markdown',
          defaultPath: await join(lastFolder ?? (await downloadDir()), fileName),
          filters: [
            {
              name: extension === 'pdf' ? 'PDF document' : 'Markdown note',
              extensions: [extension],
            },
          ],
        }),
      );
    } catch (error) {
      return failure(describeStorageError(error, 'Could not open the save dialog.'));
    }
  }
  async writeBundle(bundle: ExportBundle) {
    try {
      const metadata = {
        path: bundle.path,
        contentLength: bundle.bytes.length,
        assets: bundle.assets.map((asset) => ({ name: asset.name, length: asset.bytes.length })),
      };
      const bytes = new Uint8Array(
        bundle.bytes.length +
          bundle.assets.reduce((length, asset) => length + asset.bytes.length, 0),
      );
      bytes.set(bundle.bytes);
      let offset = bundle.bytes.length;
      for (const asset of bundle.assets) {
        bytes.set(asset.bytes, offset);
        offset += asset.bytes.length;
      }
      await invoke('write_note_export', bytes, {
        headers: { 'x-anehalo-export': encodeURIComponent(JSON.stringify(metadata)) },
      });
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'io-error',
        message: 'Could not save the file. Check that the folder is writable.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async writeClipboard(text: string, html?: string) {
    try {
      if (!isTauri()) await writeBrowserClipboard(text, html);
      else {
        for (let attempt = 0; ; attempt += 1) {
          try {
            if (html !== undefined) await writeHtml(html, text);
            else await writeText(text);
            break;
          } catch (error) {
            if (attempt < 3) {
              await new Promise<void>((resolve) => setTimeout(resolve, 80 * 2 ** attempt));
              continue;
            }
            if (document.hasFocus() && document.queryCommandSupported('copy'))
              await writeBrowserClipboard(text, html);
            else throw error;
            break;
          }
        }
      }
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'unavailable',
        message: 'Could not copy the note. The clipboard is busy or unavailable. Try again.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async loadImage(notePath: string, reference: string) {
    try {
      let bytes: Uint8Array;
      if (/^https?:\/\//i.test(reference)) {
        const response = await fetch(reference, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        const path = resolveAttachmentReference(notePath, reference);
        if (!path)
          return failure({
            code: 'invalid-path',
            message: 'An image does not point to a vault attachment.',
          });
        const files = new TauriVaultFileSystem(() => Promise.resolve(this.vaultPath), false);
        await files.initialize();
        bytes = await files.readBytes(path);
      }
      const extension = imageExtension(bytes);
      if (!extension.ok) return extension;
      const mimeType = extension.value === 'jpg' ? 'image/jpeg' : `image/${extension.value}`;
      return success({ name: `${crypto.randomUUID()}.${extension.value}`, bytes, mimeType });
    } catch (error) {
      return failure(describeStorageError(error, 'Could not load an image for export.'));
    }
  }
  async revealFile(path: string) {
    try {
      await revealItemInDir(path);
      return success(undefined);
    } catch (error) {
      return failure(describeStorageError(error, 'Could not show the exported file.'));
    }
  }
}
