export type RepositoryErrorCode =
  | 'scan-limit'
  | 'legacy-vault'
  | 'path-too-long'
  | 'disk-full'
  | 'conflict'
  | 'invalid-name'
  | 'invalid-path'
  | 'already-exists'
  | 'not-found'
  | 'invalid-type'
  | 'permission-denied'
  | 'unavailable'
  | 'io-error';

export interface RepositoryError {
  readonly code: RepositoryErrorCode;
  readonly message: string;
  readonly detail?: string;
}

export type RepositoryResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: RepositoryError };

export function success<Value>(value: Value): RepositoryResult<Value> {
  return { ok: true, value };
}

export function failure(error: RepositoryError): RepositoryResult<never> {
  return { ok: false, error };
}

export class StorageFailure extends Error {
  constructor(readonly storageError: RepositoryError) {
    super(storageError.message);
    this.name = 'StorageFailure';
  }
}

export function storageFailure(code: RepositoryErrorCode, message: string): never {
  throw new StorageFailure({ code, message });
}

export function describeStorageError(error: unknown, action: string): RepositoryError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.message === 'string' &&
    typeof error.code === 'string' &&
    [
      'scan-limit',
      'legacy-vault',
      'path-too-long',
      'disk-full',
      'conflict',
      'invalid-name',
      'invalid-path',
      'already-exists',
      'not-found',
      'invalid-type',
      'permission-denied',
      'unavailable',
      'io-error',
    ].includes(error.code)
  )
    return {
      code: error.code as RepositoryErrorCode,
      message: action ? `${action} ${error.message}` : error.message,
    };
  const detail = error instanceof Error ? error.message : String(error);
  if (error instanceof StorageFailure)
    return { ...error.storageError, message: `${action} ${error.storageError.message}` };
  const code: RepositoryErrorCode =
    /path.*too long|filename.*too long|os error (206|36)\b|ENAMETOOLONG/i.test(detail)
      ? 'path-too-long'
      : /disk.*full|not enough space|no space left|os error (28|112)\b/i.test(detail)
        ? 'disk-full'
        : /not found|cannot find|does not exist|os error [23]\b/i.test(detail)
          ? 'not-found'
          : /already exists|os error (80|183)\b/i.test(detail)
            ? 'already-exists'
            : /permission|denied|forbidden|not allowed|os error [15]\b/i.test(detail)
              ? 'permission-denied'
              : 'io-error';
  const explanation =
    code === 'path-too-long'
      ? 'The path is too long. Choose a shorter folder path or note title.'
      : code === 'disk-full'
        ? 'The disk is full. Free some space and retry. Your unsaved text remains in the editor.'
        : code === 'not-found'
          ? 'The file or folder no longer exists. Reload the vault and try again.'
          : code === 'permission-denied'
            ? 'Access was denied. Check the vault permissions and whether another app has locked the file.'
            : code === 'already-exists'
              ? 'A file or folder with that name exists.'
              : 'Check that the vault is available and try again.';
  return { code, message: `${action} ${explanation}`, detail };
}
