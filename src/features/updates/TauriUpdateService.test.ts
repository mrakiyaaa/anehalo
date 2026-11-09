import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unwrapResult } from '@/test/repository-helpers';
import { TauriUpdateService } from './TauriUpdateService';
import type { DownloadProgress } from './UpdateService';

const native = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
  getVersion: vi.fn(),
  isTauri: vi.fn(),
  runtimePaths: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: native.check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: native.relaunch }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: native.getVersion }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: native.isTauri }));
vi.mock('@/app/runtime-paths', () => ({ runtimePaths: native.runtimePaths }));

type Progress = { event: 'Started' | 'Progress' | 'Finished'; data?: Record<string, number> };

function nativeUpdate(version = '0.1.2') {
  return {
    version,
    download: vi.fn(async (onEvent: (event: Progress) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 40 } });
      onEvent({ event: 'Progress', data: { chunkLength: 60 } });
      onEvent({ event: 'Finished' });
      await Promise.resolve();
    }),
    install: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
}

beforeEach(() => {
  // A release build, running for real, as an installed copy does.
  vi.stubEnv('DEV', false);
  native.isTauri.mockReturnValue(true);
  native.runtimePaths.mockResolvedValue({ isolated: false });
  native.relaunch.mockResolvedValue(undefined);
  native.getVersion.mockResolvedValue('0.1.1');
});

describe('where updates are allowed', () => {
  it('works in an installed release build', async () => {
    expect(await new TauriUpdateService().isSupported()).toBe(true);
  });

  it.each([
    ['a development build', () => vi.stubEnv('DEV', true)],
    ['outside the desktop shell', () => native.isTauri.mockReturnValue(false)],
    ['an isolated test run', () => native.runtimePaths.mockResolvedValue({ isolated: true })],
    ['when the paths cannot be read', () => native.runtimePaths.mockRejectedValue(new Error('no'))],
  ])('is off in %s, and nothing reaches the updater', async (_name, arrange) => {
    arrange();
    const service = new TauriUpdateService();
    expect(await service.isSupported()).toBe(false);
    expect((await service.check()).ok).toBe(false);
    expect((await service.download(vi.fn())).ok).toBe(false);
    expect((await service.install()).ok).toBe(false);
    expect((await service.relaunch()).ok).toBe(false);
    expect(native.check).not.toHaveBeenCalled();
    expect(native.relaunch).not.toHaveBeenCalled();
  });
});

describe('checking, downloading and installing', () => {
  it('reports an available version, with a timeout so a dead network cannot hang', async () => {
    native.check.mockResolvedValue(nativeUpdate('0.1.2'));
    expect(unwrapResult(await new TauriUpdateService().check())).toEqual({ version: '0.1.2' });
    expect(native.check).toHaveBeenCalledWith({ timeout: 30_000 });
  });

  it('reports no offer when the app is up to date', async () => {
    native.check.mockResolvedValue(null);
    expect(unwrapResult(await new TauriUpdateService().check())).toBeNull();
  });

  it('returns a failure, and does not throw, when the network is down', async () => {
    native.check.mockRejectedValue(new Error('error sending request'));
    const result = await new TauriUpdateService().check();
    expect(result.ok).toBe(false);
  });

  it('turns native download events into running totals', async () => {
    const update = nativeUpdate();
    native.check.mockResolvedValue(update);
    const service = new TauriUpdateService();
    await service.check();
    const progress = vi.fn<(step: DownloadProgress) => void>();
    unwrapResult(await service.download(progress));
    expect(progress.mock.calls.map(([step]) => step)).toEqual([
      { downloaded: 0, total: 100 },
      { downloaded: 40, total: 100 },
      { downloaded: 100, total: 100 },
    ]);
  });

  it('installs the update that was downloaded, then relaunches', async () => {
    const update = nativeUpdate();
    native.check.mockResolvedValue(update);
    const service = new TauriUpdateService();
    await service.check();
    unwrapResult(await service.download(vi.fn()));
    unwrapResult(await service.install());
    expect(update.install).toHaveBeenCalledTimes(1);
    unwrapResult(await service.relaunch());
    expect(native.relaunch).toHaveBeenCalledTimes(1);
  });

  it('refuses to download or install when no update was found', async () => {
    const service = new TauriUpdateService();
    expect((await service.download(vi.fn())).ok).toBe(false);
    expect((await service.install()).ok).toBe(false);
  });

  it('reports a failed download or install as a result', async () => {
    const update = nativeUpdate();
    update.download.mockRejectedValue(new Error('signature mismatch'));
    update.install.mockRejectedValue(new Error('blocked'));
    native.check.mockResolvedValue(update);
    const service = new TauriUpdateService();
    await service.check();
    expect((await service.download(vi.fn())).ok).toBe(false);
    expect((await service.install()).ok).toBe(false);
  });

  it('releases the native handle of an offer that is replaced', async () => {
    const first = nativeUpdate('0.1.2');
    const second = nativeUpdate('0.1.3');
    native.check.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const service = new TauriUpdateService();
    await service.check();
    await service.check();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
  });

  it('reads the version from the running app', async () => {
    native.getVersion.mockResolvedValue('7.8.9');
    expect(unwrapResult(await new TauriUpdateService().currentVersion())).toBe('7.8.9');
    native.getVersion.mockRejectedValue(new Error('not allowed'));
    expect((await new TauriUpdateService().currentVersion()).ok).toBe(false);
  });
});
