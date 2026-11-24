import {
  StorageFailure,
  type RepositoryError,
  type RepositoryErrorCode,
} from '@/features/storage/repository-result';
import type { DiagramExportOptions } from './diagram-export-options';

export type DiagramExportFailure =
  'empty' | 'canvas-too-large' | 'render-failed' | 'save-failed' | 'clipboard-failed';

/** A diagram could not be exported; the message is written for the person using the app. */
export class DiagramExportError extends StorageFailure {
  constructor(
    readonly reason: DiagramExportFailure,
    message: string,
    code: RepositoryErrorCode = 'unavailable',
    detail?: string,
  ) {
    super({ code, message, ...(detail === undefined ? {} : { detail }) });
    this.name = 'DiagramExportError';
  }
}

export function canvasTooLargeError(options: DiagramExportOptions): DiagramExportError {
  return new DiagramExportError(
    'canvas-too-large',
    options.format === 'png' && options.scale > 1
      ? `This diagram is too large to export at ${options.scale}×. Try a lower scale.`
      : 'This diagram is too large to export as an image. Try exporting a selection instead.',
  );
}

const canvasFailure =
  /couldn't export to blob|canvas|too large|invalid (array|string) length|out of memory/i;

/**
 * What an unexpected drawing failure means to the user. Browsers fail without a reason when a
 * canvas is too big, so those failures are recognised by their wording.
 */
export function exportErrorFrom(error: unknown, options: DiagramExportOptions): DiagramExportError {
  if (error instanceof DiagramExportError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  if (error instanceof RangeError || canvasFailure.test(detail))
    return canvasTooLargeError(options);
  return new DiagramExportError(
    'render-failed',
    'This diagram could not be drawn for export.',
    'unavailable',
    detail,
  );
}

export function exportFailureOf(error: unknown, options: DiagramExportOptions): RepositoryError {
  return exportErrorFrom(error, options).storageError;
}
