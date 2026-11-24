import { sanitizeName } from '@/features/storage/note-names';
import { StorageFailure } from '@/features/storage/repository-result';
import type { ExportExtension } from './export-types';

export function exportFileName(
  title: string,
  extension: ExportExtension,
  fallback = 'Untitled note',
): string {
  const name = title.replace(/\.(md|pdf|png|svg|excalidraw)$/i, '');
  try {
    return `${sanitizeName(name, fallback)}.${extension}`;
  } catch (error) {
    if (!(error instanceof StorageFailure) || error.storageError.code !== 'invalid-name')
      throw error;
    return `${sanitizeName(`_${name}`, fallback)}.${extension}`;
  }
}
export function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? '';
}
export function exportFolder(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
}
export function assetsFolderName(path: string): string {
  return `${fileName(path).replace(/\.md$/i, '')}_assets`;
}
export function encodeExportReference(path: string): string {
  return path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}
