import { describe, expect, it, vi } from 'vitest';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { unwrapResult } from '@/test/repository-helpers';
import { WindowVisibilityController } from './WindowVisibilityController';

function setup(keepRunningInTray = true, hasOpenEditor = true) {
  const tray = new FakeTrayService();
  const flushPendingSaves = vi.fn<() => Promise<RepositoryResult<void>>>(() =>
    Promise.resolve(success(undefined)),
  );
  const controller = new WindowVisibilityController(tray, {
    keepRunningInTray: () => keepRunningInTray,
    hasOpenEditor: () => hasOpenEditor,
    flushPendingSaves,
  });
  return { tray, controller, flushPendingSaves };
}

describe('window visibility', () => {
  it.each([
    { visible: false, minimized: false, focused: false },
    { visible: true, minimized: true, focused: false },
    { visible: true, minimized: false, focused: false },
  ])('restores and focuses an existing editor from %j', async (visibility) => {
    const { tray, controller, flushPendingSaves } = setup();
    tray.visibility = visibility;
    unwrapResult(await controller.toggle());
    expect(tray.actions).toEqual(['show', 'focus-editor']);
    expect(tray.visibility).toEqual({ visible: true, minimized: false, focused: true });
    expect(flushPendingSaves).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'conceals a focused window using the tray preference %s',
    async (trayEnabled) => {
      const { tray, controller, flushPendingSaves } = setup(trayEnabled);
      unwrapResult(await controller.toggle());
      expect(tray.actions).toEqual([trayEnabled ? 'hide' : 'minimize']);
      expect(flushPendingSaves).toHaveBeenCalledOnce();
    },
  );

  it('flushes a pending save before hiding', async () => {
    const { tray, controller, flushPendingSaves } = setup();
    let finishSave: () => void = () => {
      throw new Error('Save was not started.');
    };
    flushPendingSaves.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve(success(undefined));
        }),
    );
    const toggled = controller.toggle();
    await vi.waitFor(() => expect(flushPendingSaves).toHaveBeenCalledOnce());
    expect(tray.actions).toEqual([]);
    finishSave();
    unwrapResult(await toggled);
    expect(tray.actions).toEqual(['hide']);
  });

  it('keeps the window visible if a save fails', async () => {
    const { tray, controller, flushPendingSaves } = setup();
    flushPendingSaves.mockResolvedValueOnce(
      failure({ code: 'disk-full', message: 'Free some space.' }),
    );
    expect(await controller.toggle()).toMatchObject({ ok: false, error: { code: 'disk-full' } });
    expect(tray.actions).toEqual([]);
  });

  it.each([true, false])(
    'uses visibility for tray clicks even when clicking the tray takes focus (keep running: %s)',
    async (keepRunning) => {
      const { tray, controller } = setup(keepRunning);
      tray.visibility.focused = false;
      unwrapResult(await controller.toggle('tray'));
      expect(tray.actions).toEqual(['hide']);
    },
  );

  it('keeps a non-editor view and serializes rapid toggles', async () => {
    const { tray, controller } = setup(true, false);
    tray.visibility.visible = false;
    await Promise.all([controller.toggle(), controller.toggle()]);
    expect(tray.actions).toEqual(['show', 'hide']);
  });

  it('returns typed errors when the window state cannot be read', async () => {
    const { tray, controller } = setup();
    vi.spyOn(tray, 'windowState').mockRejectedValueOnce(new Error('Unavailable'));
    expect(await controller.toggle()).toMatchObject({ ok: false, error: { code: 'io-error' } });
    expect(tray.actions).toEqual([]);
  });
});
