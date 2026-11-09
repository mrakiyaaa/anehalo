import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logFailure } from '@/features/diagnostics/error-logging';
import { failure, success } from '@/features/storage/repository-result';
import { FakeUpdateService } from './FakeUpdateService';
import {
  CHECK_INTERVAL_MS,
  STARTUP_CHECK_DELAY_MS,
  UpdateController,
  visibleUpdate,
  type UpdateHost,
} from './UpdateController';

vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure: vi.fn() }));

const controllers: UpdateController[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  vi.useRealTimers();
});

function setup(options: { autoCheck?: boolean; saveFails?: boolean[] } = {}) {
  const calls: string[] = [];
  const service = new FakeUpdateService(calls);
  const saveResults = [...(options.saveFails ?? [])];
  const host: UpdateHost & { autoCheckOn: boolean } = {
    autoCheckOn: options.autoCheck ?? true,
    autoCheck() {
      return this.autoCheckOn;
    },
    flushPendingSaves() {
      calls.push('flush');
      return Promise.resolve(
        saveResults.shift()
          ? failure({ code: 'io-error', message: 'Disk full.' })
          : success(undefined),
      );
    },
    setEditingLocked: (locked) => calls.push(locked ? 'lock' : 'unlock'),
  };
  const controller = new UpdateController(service, host);
  controllers.push(controller);
  const state = () => controller.state.getState();
  return { calls, service, host, controller, state };
}
const checks = (calls: readonly string[]) => calls.filter((call) => call === 'check').length;

describe('when checks run', () => {
  it('checks 10 seconds after start, then every 6 hours', async () => {
    const { controller, service } = setup();
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS - 1);
    expect(checks(service.calls)).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(checks(service.calls)).toBe(1);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - 1);
    expect(checks(service.calls)).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(checks(service.calls)).toBe(2);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(checks(service.calls)).toBe(3);
  });

  it('never checks in a build where updates are off, such as development', async () => {
    const { controller, service, state } = setup();
    service.supported = false;
    await controller.start();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(checks(service.calls)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(state().supported).toBe(false);
    // Even the button does nothing there.
    await controller.checkNow();
    expect(checks(service.calls)).toBe(0);
  });

  it('skips checks while the setting is off and resumes when it is turned on', async () => {
    const { controller, host, service } = setup({ autoCheck: false });
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(checks(service.calls)).toBe(0);
    host.autoCheckOn = true;
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(checks(service.calls)).toBe(1);
  });

  it('starts only one schedule even if started, stopped and started again', async () => {
    const { controller, service } = setup();
    const first = controller.start();
    controller.stop();
    await first;
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(checks(service.calls)).toBe(1);
    controller.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reads the running version from the app', async () => {
    const { controller, service, state } = setup();
    service.version = '4.5.6';
    await controller.start();
    expect(state().currentVersion).toBe('4.5.6');
  });
});

describe('what the background check shows', () => {
  it('stays silent and logs when offline', async () => {
    const { controller, service, state } = setup();
    service.goOffline();
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(checks(service.calls)).toBe(1);
    expect(visibleUpdate(state())).toEqual({ kind: 'idle' });
    expect(state().manualCheck).toBe('idle');
    expect(logFailure).toHaveBeenCalledWith('update-check-failed', 'unavailable');
  });

  it('offers a newer version', async () => {
    const { controller, service, state } = setup();
    service.offer = { version: '0.1.2' };
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(visibleUpdate(state())).toEqual({ kind: 'available', version: '0.1.2' });
  });

  it('keeps an offer hidden after "Later", for the rest of the session', async () => {
    const { controller, service, state } = setup();
    service.offer = { version: '0.1.2' };
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    controller.later();
    expect(visibleUpdate(state())).toEqual({ kind: 'idle' });
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(visibleUpdate(state())).toEqual({ kind: 'idle' });
    // A new session starts with nothing dismissed.
    const next = new UpdateController(service, { ...setup().host });
    controllers.push(next);
    await next.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(visibleUpdate(next.state.getState())).toEqual({ kind: 'available', version: '0.1.2' });
  });

  it('does not re-check while an offer is waiting', async () => {
    const { controller, service } = setup();
    service.offer = { version: '0.1.2' };
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS + CHECK_INTERVAL_MS * 3);
    expect(checks(service.calls)).toBe(1);
  });
});

describe('the Check for updates button', () => {
  it('says the app is up to date', async () => {
    const { controller, state } = setup();
    await controller.start();
    await controller.checkNow();
    expect(state().manualCheck).toBe('up-to-date');
    expect(state().currentVersion).toBe('0.1.1');
  });

  it('shows the update when there is one, even after "Later"', async () => {
    const { controller, service, state } = setup();
    service.offer = { version: '0.1.2' };
    await controller.start();
    await controller.checkNow();
    controller.later();
    expect(visibleUpdate(state())).toEqual({ kind: 'idle' });
    await controller.checkNow();
    expect(visibleUpdate(state())).toEqual({ kind: 'available', version: '0.1.2' });
  });

  it('reports a failed check, unlike the background check', async () => {
    const { controller, service, state } = setup();
    service.goOffline();
    await controller.start();
    await controller.checkNow();
    expect(state().manualCheck).toBe('failed');
  });

  it('ignores a second press while a check is running', async () => {
    const { controller, service } = setup();
    await controller.start();
    await Promise.all([controller.checkNow(), controller.checkNow()]);
    expect(checks(service.calls)).toBe(1);
  });

  it('shares the network check that a background check already started', async () => {
    const { controller, service, state } = setup();
    let release = () => {};
    service.checkGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    service.offer = { version: '0.1.2' };
    await controller.start();
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS);
    expect(checks(service.calls)).toBe(1);
    const pressed = controller.checkNow();
    release();
    await pressed;
    expect(checks(service.calls)).toBe(1);
    expect(visibleUpdate(state())).toEqual({ kind: 'available', version: '0.1.2' });
  });
});

describe('Update now', () => {
  async function offered(options: Parameters<typeof setup>[0] = {}) {
    const context = setup(options);
    context.service.offer = { version: '0.1.2' };
    await context.controller.start();
    await context.controller.checkNow();
    context.calls.length = 0;
    return context;
  }

  // Locking before the last save matters: a key typed between the two would otherwise be lost.
  it('saves, downloads, locks editing, saves again, then installs and relaunches', async () => {
    const { controller, calls } = await offered();
    await controller.installNow();
    expect(calls).toEqual(['flush', 'download', 'lock', 'flush', 'install', 'relaunch']);
  });

  it('shows download progress, then installing', async () => {
    const { controller, service, state } = await offered();
    let release = () => {};
    service.downloadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const updating = controller.installNow();
    await vi.waitFor(() =>
      expect(state().status).toEqual({
        kind: 'downloading',
        version: '0.1.2',
        downloaded: 1000,
        total: 1000,
      }),
    );
    release();
    await updating;
    expect(state().status.kind).toBe('installing');
  });

  it('never starts a download or the installer when notes cannot be saved first', async () => {
    const { controller, calls, state } = await offered({ saveFails: [true] });
    await controller.installNow();
    expect(calls).toEqual(['flush']);
    expect(state().status).toMatchObject({ kind: 'error', version: '0.1.2' });
    expect(visibleUpdate(state())).toMatchObject({ kind: 'error' });
  });

  it('does not install, and unlocks editing, when the final save fails', async () => {
    const { controller, calls, state } = await offered({ saveFails: [false, true] });
    await controller.installNow();
    expect(calls).toEqual(['flush', 'download', 'lock', 'flush', 'unlock']);
    expect(state().status.kind).toBe('error');
  });

  it('reports a failed download and can try again', async () => {
    const { controller, service, calls, state } = await offered();
    service.downloadError = { code: 'unavailable', message: 'Offline.' };
    await controller.installNow();
    expect(calls).not.toContain('install');
    expect(state().status).toMatchObject({ kind: 'error', version: '0.1.2' });
    expect(logFailure).toHaveBeenCalledWith('update-install-failed', 'unavailable');

    service.downloadError = null;
    calls.length = 0;
    await controller.installNow();
    expect(calls).toEqual(['flush', 'download', 'lock', 'flush', 'install', 'relaunch']);
  });

  it('unlocks editing when the installer fails to start', async () => {
    const { controller, service, calls, state } = await offered();
    service.installError = { code: 'io-error', message: 'Blocked.' };
    await controller.installNow();
    expect(calls.slice(-3)).toEqual(['flush', 'install', 'unlock']);
    expect(calls).not.toContain('relaunch');
    expect(state().status.kind).toBe('error');
  });

  it('tells the user to restart if the relaunch fails after installing', async () => {
    const { controller, service, state } = await offered();
    service.relaunchError = { code: 'unavailable', message: 'No.' };
    await controller.installNow();
    expect(state().status).toMatchObject({ kind: 'error' });
    const status = state().status;
    expect(status.kind === 'error' && status.message).toContain('Close it and open it again');
  });

  it('keeps the offer when an error is dismissed, but hides it', async () => {
    const { controller, service, state } = await offered();
    service.downloadError = { code: 'unavailable', message: 'Offline.' };
    await controller.installNow();
    controller.dismissError();
    expect(visibleUpdate(state())).toEqual({ kind: 'idle' });
    expect(state().status).toEqual({ kind: 'available', version: '0.1.2' });
  });

  it('does nothing when there is no update to install', async () => {
    const { controller, calls } = setup();
    await controller.start();
    await controller.installNow();
    expect(calls).not.toContain('download');
  });

  it('refuses to start twice at once', async () => {
    const { controller, service, calls } = await offered();
    let release = () => {};
    service.downloadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = controller.installNow();
    await vi.waitFor(() => expect(calls).toContain('download'));
    await controller.installNow();
    release();
    await first;
    expect(calls.filter((call) => call === 'download')).toHaveLength(1);
  });
});
