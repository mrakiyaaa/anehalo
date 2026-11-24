import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

/** The excalidraw.com export the app's own unit tests use: frames, bound text, arrows, image. */
export const excalidrawComFixture = () =>
  readFile('src/features/diagrams/fixtures/excalidraw-com-export.excalidraw', 'utf8');

export interface DroppedFile {
  readonly name: string;
  readonly base64: string;
  readonly type?: string;
}

export const droppedText = (
  name: string,
  text: string,
  type = 'application/json',
): DroppedFile => ({
  name,
  base64: Buffer.from(text, 'utf8').toString('base64'),
  type,
});

/** Starts dragging files over the window, as the system does when files are dragged in. */
export async function dragFilesOver(page: Page, files: readonly DroppedFile[]) {
  await dispatchDrag(page, files, ['dragenter', 'dragover']);
}

/** Drops files on the window. The app runs with native drag and drop off, so web events arrive. */
export async function dropFiles(page: Page, files: readonly DroppedFile[]) {
  await dispatchDrag(page, files, ['dragenter', 'dragover', 'drop']);
}

async function dispatchDrag(page: Page, files: readonly DroppedFile[], events: readonly string[]) {
  await page.evaluate(
    ({ entries, types }) => {
      const transfer = new DataTransfer();
      for (const entry of entries) {
        const bytes = Uint8Array.from(atob(entry.base64), (character) => character.charCodeAt(0));
        transfer.items.add(new File([bytes], entry.name, { type: entry.type ?? '' }));
      }
      for (const type of types)
        document.body.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
        );
    },
    { entries: files, types: events },
  );
}

export interface ClipboardImage {
  readonly hasImage: boolean;
  readonly width: number;
  readonly height: number;
}

/** What the Windows clipboard holds, read through a real STA PowerShell, as another app would. */
export async function readClipboardImage(): Promise<ClipboardImage> {
  const { stdout } = await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('e2e/support/clipboard-image.ps1'),
    ],
    { windowsHide: true, timeout: 20_000 },
  );
  return JSON.parse(stdout) as ClipboardImage;
}
