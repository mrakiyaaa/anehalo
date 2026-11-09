import type { RepositoryResult } from '@/features/storage/repository-result';

export interface UpdateOffer {
  readonly version: string;
}

export interface DownloadProgress {
  readonly downloaded: number;
  /** Null when the server does not say how large the download is. */
  readonly total: number | null;
}

export interface UpdateService {
  /**
   * False in development builds and isolated test runs. Nothing is checked, downloaded or
   * installed there, so a developer's copy is never replaced by a release.
   */
  isSupported(): Promise<boolean>;
  /** The version of the running app, read from the app itself. */
  currentVersion(): Promise<RepositoryResult<string>>;
  /** Resolves to null when the running app is already the newest version. */
  check(): Promise<RepositoryResult<UpdateOffer | null>>;
  /** Downloads and verifies the update found by the last check. */
  download(onProgress: (progress: DownloadProgress) => void): Promise<RepositoryResult<void>>;
  /** Starts the installer. On Windows the app exits while this runs. */
  install(): Promise<RepositoryResult<void>>;
  relaunch(): Promise<RepositoryResult<void>>;
}
