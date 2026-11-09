import { createStore } from 'zustand/vanilla';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { RepositoryResult } from '@/features/storage/repository-result';
import type { UpdateService } from './UpdateService';

export const STARTUP_CHECK_DELAY_MS = 10_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type UpdateStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'available'; readonly version: string }
  | {
      readonly kind: 'downloading';
      readonly version: string;
      readonly downloaded: number;
      readonly total: number | null;
    }
  | { readonly kind: 'installing'; readonly version: string }
  | { readonly kind: 'error'; readonly version: string; readonly message: string };

/** The result of the last check the user asked for in Settings. */
export type ManualCheck = 'idle' | 'checking' | 'up-to-date' | 'failed';

export interface UpdateState {
  /** Null until the service has said whether updates work in this build. */
  readonly supported: boolean | null;
  readonly currentVersion: string | null;
  readonly status: UpdateStatus;
  /** "Later" was chosen: the banner stays hidden until the next start. */
  readonly dismissed: boolean;
  readonly manualCheck: ManualCheck;
}

export interface UpdateHost {
  /** Whether the "Automatically check for updates" setting is on right now. */
  autoCheck(): boolean;
  /** Saves every open note and pending setting. */
  flushPendingSaves(): Promise<RepositoryResult<void>>;
  /** Stops edits while the installer takes over, as when the window is being closed. */
  setEditingLocked(locked: boolean): void;
}

type CheckOutcome = 'available' | 'up-to-date' | 'failed';

const NONE: UpdateStatus = { kind: 'idle' };

/** What the banner shows: nothing while an offer is dismissed with "Later". */
export function visibleUpdate(state: UpdateState): UpdateStatus {
  return state.dismissed && state.status.kind === 'available' ? NONE : state.status;
}

const messages = {
  notSaved: 'Your notes could not be saved first, so the update was not started. Nothing was lost.',
  download: 'The update could not be downloaded. Check your internet connection and try again.',
  install: 'The update could not be installed. Your notes are safe. Try again in a moment.',
  restart: 'Anehalo was updated. Close it and open it again to finish.',
} as const;

export class UpdateController {
  readonly state = createStore<UpdateState>(() => ({
    supported: null,
    currentVersion: null,
    status: NONE,
    dismissed: false,
    manualCheck: 'idle',
  }));
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private checking: Promise<CheckOutcome> | null = null;

  constructor(
    private readonly service: UpdateService,
    private readonly host: UpdateHost,
  ) {}

  /** Learns whether updates work here, then checks 10 seconds from now and every 6 hours. */
  async start(): Promise<void> {
    this.clearTimers();
    const generation = ++this.generation;
    const [supported, version] = await Promise.all([
      this.service.isSupported(),
      this.service.currentVersion(),
    ]);
    if (generation !== this.generation) return;
    this.state.setState({ supported, currentVersion: version.ok ? version.value : null });
    if (!supported) return;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      void this.backgroundCheck();
      this.intervalTimer = setInterval(() => {
        void this.backgroundCheck();
      }, CHECK_INTERVAL_MS);
    }, STARTUP_CHECK_DELAY_MS);
  }

  stop() {
    this.generation += 1;
    this.clearTimers();
  }

  private clearTimers() {
    if (this.startupTimer !== null) clearTimeout(this.startupTimer);
    if (this.intervalTimer !== null) clearInterval(this.intervalTimer);
    this.startupTimer = null;
    this.intervalTimer = null;
  }

  private isBusy(): boolean {
    const { status, manualCheck } = this.state.getState();
    return (
      status.kind === 'downloading' || status.kind === 'installing' || manualCheck === 'checking'
    );
  }

  private check(): Promise<CheckOutcome> {
    this.checking ??= this.performCheck().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  private async performCheck(): Promise<CheckOutcome> {
    const result = await this.service.check();
    if (!result.ok) {
      // A failed check is routine (offline, GitHub unreachable), so it is logged and not shown.
      logFailure('update-check-failed', result.error.code);
      return 'failed';
    }
    if (!result.value) return 'up-to-date';
    const { status } = this.state.getState();
    if (status.kind !== 'downloading' && status.kind !== 'installing')
      this.state.setState({ status: { kind: 'available', version: result.value.version } });
    return 'available';
  }

  /** The scheduled check. It never shows an error and never interrupts an offer or an install. */
  private async backgroundCheck(): Promise<void> {
    if (!this.host.autoCheck() || this.isBusy() || this.state.getState().status.kind !== 'idle')
      return;
    await this.check();
  }

  /** The "Check for updates" button in Settings. */
  async checkNow(): Promise<void> {
    if (!this.state.getState().supported || this.isBusy()) return;
    this.state.setState({ manualCheck: 'checking' });
    const outcome = await this.check();
    if (outcome === 'available') this.state.setState({ manualCheck: 'idle', dismissed: false });
    else this.state.setState({ manualCheck: outcome === 'up-to-date' ? 'up-to-date' : 'failed' });
  }

  /** "Later": hide the offer until the next start. */
  later() {
    if (this.state.getState().status.kind === 'available') this.state.setState({ dismissed: true });
  }

  /** Closes an error. The offer is kept, so Settings can still install it. */
  dismissError() {
    const { status } = this.state.getState();
    if (status.kind === 'error')
      this.state.setState({
        status: { kind: 'available', version: status.version },
        dismissed: true,
      });
  }

  /**
   * Saves everything, downloads, saves again, and only then starts the installer, so nothing
   * typed before or during the download can be lost. If saving fails the installer never starts.
   */
  async installNow(): Promise<void> {
    const current = this.state.getState().status;
    if (current.kind !== 'available' && current.kind !== 'error') return;
    const { version } = current;
    const fail = (message: string) =>
      this.state.setState({ status: { kind: 'error', version, message }, dismissed: false });

    this.state.setState({
      status: { kind: 'downloading', version, downloaded: 0, total: null },
      dismissed: false,
    });
    if (!(await this.host.flushPendingSaves()).ok) return fail(messages.notSaved);

    const downloaded = await this.service.download((progress) => {
      if (this.state.getState().status.kind === 'downloading')
        this.state.setState({ status: { kind: 'downloading', version, ...progress } });
    });
    if (!downloaded.ok) {
      logFailure('update-install-failed', downloaded.error.code);
      return fail(messages.download);
    }

    // Anything typed while downloading is saved now, and editing stays off until the app exits.
    this.state.setState({ status: { kind: 'installing', version } });
    this.host.setEditingLocked(true);
    if (!(await this.host.flushPendingSaves()).ok) {
      this.host.setEditingLocked(false);
      return fail(messages.notSaved);
    }

    const installed = await this.service.install();
    if (!installed.ok) {
      this.host.setEditingLocked(false);
      logFailure('update-install-failed', installed.error.code);
      return fail(messages.install);
    }

    // On Windows the installer restarts the app and this point is not reached.
    const relaunched = await this.service.relaunch();
    if (!relaunched.ok) {
      this.host.setEditingLocked(false);
      logFailure('update-install-failed', relaunched.error.code);
      fail(messages.restart);
    }
  }
}
