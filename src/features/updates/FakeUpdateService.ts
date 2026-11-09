import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DownloadProgress, UpdateOffer, UpdateService } from './UpdateService';

const networkError: RepositoryError = { code: 'unavailable', message: 'The network is down.' };

/** A scriptable stand-in for the native updater. `calls` records the order of operations. */
export class FakeUpdateService implements UpdateService {
  /** Pass an array shared with a test's other fakes to see one combined order of events. */
  constructor(readonly calls: string[] = []) {}
  supported = true;
  version = '0.1.1';
  offer: UpdateOffer | null = null;
  checkError: RepositoryError | null = null;
  downloadError: RepositoryError | null = null;
  installError: RepositoryError | null = null;
  relaunchError: RepositoryError | null = null;
  progress: readonly DownloadProgress[] = [
    { downloaded: 0, total: 1000 },
    { downloaded: 500, total: 1000 },
    { downloaded: 1000, total: 1000 },
  ];
  /** Awaited before a check finishes, so a test can overlap two checks. */
  checkGate: Promise<void> | null = null;
  /** Awaited before a download finishes, so a test can observe the downloading state. */
  downloadGate: Promise<void> | null = null;
  /** Runs when the download starts, e.g. to type into a note mid-download. */
  onDownload: (() => void | Promise<void>) | null = null;
  /** Runs when the installer would start, to inspect the app at that moment. */
  onInstall: (() => void | Promise<void>) | null = null;

  /** A convenient way to simulate being offline. */
  goOffline() {
    this.checkError = networkError;
  }

  isSupported() {
    this.calls.push('supported');
    return Promise.resolve(this.supported);
  }
  currentVersion(): Promise<RepositoryResult<string>> {
    return Promise.resolve(success(this.version));
  }
  async check(): Promise<RepositoryResult<UpdateOffer | null>> {
    this.calls.push('check');
    await this.checkGate;
    return this.checkError ? failure(this.checkError) : success(this.offer);
  }
  async download(
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<RepositoryResult<void>> {
    this.calls.push('download');
    await this.onDownload?.();
    for (const step of this.progress) onProgress(step);
    await this.downloadGate;
    return this.downloadError ? failure(this.downloadError) : success(undefined);
  }
  async install(): Promise<RepositoryResult<void>> {
    this.calls.push('install');
    await this.onInstall?.();
    return this.installError ? failure(this.installError) : success(undefined);
  }
  relaunch(): Promise<RepositoryResult<void>> {
    this.calls.push('relaunch');
    return Promise.resolve(this.relaunchError ? failure(this.relaunchError) : success(undefined));
  }
}
