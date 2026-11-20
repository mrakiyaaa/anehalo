import { StorageFailure, type RepositoryError } from '@/features/storage/repository-result';

/** The file is not a readable Excalidraw drawing. It is never written over. */
export class DiagramParseError extends StorageFailure {
  constructor(detail: string) {
    super({
      code: 'invalid-diagram',
      // Shown after the action, e.g. “This diagram can’t be opened.”
      message: 'It is not a valid Excalidraw file. The file was not changed.',
      detail,
    });
    this.name = 'DiagramParseError';
  }
}

/** Saving a diagram failed; the cause keeps the storage error code (disk full, denied…). */
export class DiagramWriteError extends StorageFailure {
  constructor(cause: RepositoryError) {
    super(cause);
    this.name = 'DiagramWriteError';
  }
}
