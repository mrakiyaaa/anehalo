import { StorageFailure, type RepositoryErrorCode } from '@/features/storage/repository-result';

export type DiagramImportFailure =
  'unsupported' | 'no-scene' | 'invalid' | 'unreadable' | 'declined' | 'write-failed';

/** One file could not be imported. Nothing was written to the vault for it. */
export class DiagramImportError extends StorageFailure {
  constructor(
    readonly reason: DiagramImportFailure,
    message: string,
    code: RepositoryErrorCode = 'invalid-diagram',
    detail?: string,
  ) {
    super({ code, message, ...(detail === undefined ? {} : { detail }) });
    this.name = 'DiagramImportError';
  }
}

export const noSceneMessage = 'This image has no diagram data to import.';

export const unsupportedFileError = () =>
  new DiagramImportError(
    'unsupported',
    'Only .excalidraw files and PNG or SVG images exported with “Embed scene” can be imported.',
  );

export const noSceneError = () => new DiagramImportError('no-scene', noSceneMessage);

export const invalidDiagramError = (detail?: string) =>
  new DiagramImportError(
    'invalid',
    'This file is not a valid Excalidraw drawing.',
    'invalid-diagram',
    detail,
  );

export const invalidImageError = (kind: 'png' | 'svg', detail?: string) =>
  new DiagramImportError(
    'invalid',
    `This ${kind.toUpperCase()} image is damaged or could not be read.`,
    'invalid-diagram',
    detail,
  );

export const declinedError = () =>
  new DiagramImportError('declined', 'Skipped: you chose not to import this large file.');
