import { afterEach, describe, expect, it, vi } from 'vitest';
import { failure } from '@/features/storage/repository-result';
import { unwrapResult } from '@/test/repository-helpers';
import { visibleUpdate } from './UpdateController';
import { createUpdateRuntime } from './update-test-runtime';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

async function setup() {
  const context = await createUpdateRuntime();
  disposers.push(context.dispose);
  context.updater.offer = { version: '0.1.2' };
  unwrapResult(await context.workspace.getState().openNote('Plan.md'));
  const identifier = context.workspace.getState().openDraft!.identifier;
  return { ...context, identifier };
}

describe('installing with notes that are not saved yet', () => {
  it('writes unsaved typing to disk before the installer starts, including typing during the download', async () => {
    const { runtime, workspace, repository, updater, identifier } = await setup();
    workspace.getState().updateNoteContent(identifier, 'typed before pressing Update now');
    await runtime.updates.start();
    await runtime.updates.checkNow();

    const seen: { unsavedAtDownload?: number; lockedAtInstall?: boolean; diskAtInstall?: string } =
      {};
    updater.onDownload = () => {
      seen.unsavedAtDownload = workspace.getState().pendingDrafts.length;
      workspace.getState().updateNoteContent(identifier, 'typed while it was downloading');
    };
    updater.onInstall = async () => {
      seen.lockedAtInstall = workspace.getState().isClosing;
      seen.diskAtInstall = unwrapResult(await repository.readNote('Plan.md')).content;
    };
    await runtime.updates.installNow();

    // The first save finished before the download began.
    expect(seen.unsavedAtDownload).toBe(0);
    // Editing was locked, and everything typed during the download was already on disk.
    expect(seen.lockedAtInstall).toBe(true);
    expect(seen.diskAtInstall).toBe('typed while it was downloading');
    expect(updater.calls.filter((call) => call !== 'supported')).toEqual([
      'check',
      'download',
      'install',
      'relaunch',
    ]);
  });

  it('never downloads or installs when a note cannot be saved', async () => {
    const { runtime, workspace, repository, updater, identifier } = await setup();
    workspace.getState().updateNoteContent(identifier, 'unsaved words');
    await runtime.updates.start();
    await runtime.updates.checkNow();
    vi.spyOn(repository, 'writeNote').mockResolvedValue(
      failure({ code: 'disk-full', message: 'There is no space left.' }),
    );
    await runtime.updates.installNow();

    expect(updater.calls).not.toContain('download');
    expect(updater.calls).not.toContain('install');
    expect(runtime.updates.state.getState().status).toMatchObject({ kind: 'error' });
    // The typed text is still in the open draft, and editing is not left locked.
    expect(workspace.getState().openDraft?.content).toBe('unsaved words');
    expect(workspace.getState().isClosing).toBe(false);
  });

  it('also saves pending settings before installing', async () => {
    const { runtime, settings, settingsRepository, updater } = await setup();
    await runtime.updates.start();
    await runtime.updates.checkNow();
    void settings.getState().update({ userName: 'Saved first' });
    await runtime.updates.installNow();
    expect(updater.calls).toContain('install');
    expect(unwrapResult(await settingsRepository.load()).userName).toBe('Saved first');
  });
});

describe('an update found while the window is hidden in the tray', () => {
  it('is kept for the next time the window is shown, and never shows the window itself', async () => {
    const { runtime, tray } = await setup();
    unwrapResult(await runtime.toggle());
    expect(tray.visibility.visible).toBe(false);
    const actionsBefore = tray.actions.length;

    vi.useFakeTimers();
    await runtime.updates.start();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(visibleUpdate(runtime.updates.state.getState())).toEqual({
      kind: 'available',
      version: '0.1.2',
    });
    expect(tray.actions.slice(actionsBefore)).toEqual([]);
    expect(tray.visibility.visible).toBe(false);
    vi.useRealTimers();

    // When the window is shown, the offer is still there to be seen.
    unwrapResult(await runtime.show());
    expect(tray.visibility.visible).toBe(true);
    expect(visibleUpdate(runtime.updates.state.getState())).toMatchObject({ kind: 'available' });
  });

  it('keeps checking in the background without showing anything when offline', async () => {
    const { runtime, tray, updater } = await setup();
    updater.goOffline();
    unwrapResult(await runtime.toggle());
    const actionsBefore = tray.actions.length;
    vi.useFakeTimers();
    await runtime.updates.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(runtime.state.getState().error).toBeNull();
    expect(runtime.state.getState().toast).toBeNull();
    expect(tray.actions.slice(actionsBefore)).toEqual([]);
  });
});
