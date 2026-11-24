import { logFailure } from '@/features/diagnostics/error-logging';
import { DiagramParseError } from '@/features/diagrams/diagram-errors';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DiagramSummary } from '@/types/notes';
import {
  declinedError,
  invalidDiagramError,
  unsupportedFileError,
  DiagramImportError,
} from './diagram-import-errors';
import {
  importFileKind,
  importTitle,
  LARGE_IMPORT_BYTES,
  type ImportFileKind,
} from './import-file-kind';

/** A file chosen or dropped by the person; its contents are read only when it is imported. */
export interface ImportCandidate {
  readonly name: string;
  readonly size: number;
  readonly bytes: () => Promise<Uint8Array>;
}

export interface SkippedImport {
  readonly name: string;
  readonly message: string;
}

export interface ImportReport {
  readonly imported: readonly DiagramSummary[];
  readonly skipped: readonly SkippedImport[];
}

export interface DiagramImportDependencies {
  /** Validates the file with Excalidraw and returns the .excalidraw text to store. */
  readonly decode: (kind: ImportFileKind, bytes: Uint8Array) => Promise<string>;
  /** Adds a diagram to the vault's folder under the first free name. */
  readonly write: (
    folder: string | null,
    title: string,
    text: string,
  ) => Promise<RepositoryResult<DiagramSummary>>;
  /** Asks whether a file over 50 MB should still be imported. */
  readonly confirmLarge: (candidate: ImportCandidate) => Promise<boolean>;
}

function skippedMessage(error: unknown): RepositoryError {
  if (error instanceof DiagramImportError) return error.storageError;
  if (error instanceof DiagramParseError)
    return invalidDiagramError(error.storageError.detail).storageError;
  return describeStorageError(error, 'Could not import the file.');
}

/**
 * Copies diagrams into the vault: .excalidraw files, and PNG or SVG images that hold an embedded
 * drawing. The originals are only read. A file that is not a readable drawing is skipped before
 * anything is written for it.
 */
export class DiagramImportService {
  constructor(private readonly dependencies: DiagramImportDependencies) {}

  async importFiles(
    candidates: readonly ImportCandidate[],
    folder: string | null,
  ): Promise<ImportReport> {
    const imported: DiagramSummary[] = [];
    const skipped: SkippedImport[] = [];
    for (const candidate of candidates) {
      const result = await this.importFile(candidate, folder);
      if (result.ok) imported.push(result.value);
      else {
        logFailure('diagram-import-failed', result.error.code);
        skipped.push({ name: candidate.name, message: result.error.message });
      }
    }
    return { imported, skipped };
  }

  private async importFile(
    candidate: ImportCandidate,
    folder: string | null,
  ): Promise<RepositoryResult<DiagramSummary>> {
    try {
      const kind = importFileKind(candidate.name);
      if (!kind) throw unsupportedFileError();
      if (candidate.size > LARGE_IMPORT_BYTES && !(await this.dependencies.confirmLarge(candidate)))
        throw declinedError();
      let bytes: Uint8Array;
      try {
        bytes = await candidate.bytes();
      } catch (error) {
        throw new DiagramImportError(
          'unreadable',
          'This file could not be read. Check that it still exists.',
          'io-error',
          error instanceof Error ? error.message : String(error),
        );
      }
      const text = await this.dependencies.decode(kind, bytes);
      const written = await this.dependencies.write(folder, importTitle(candidate.name), text);
      return written.ok ? success(written.value) : written;
    } catch (error) {
      return failure(skippedMessage(error));
    }
  }
}
