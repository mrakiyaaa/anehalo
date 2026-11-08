import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore } from '@/store/workspace-store';
import { createSettingsStore } from '@/features/settings/settings-store';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { failure } from '@/features/storage/repository-result';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { FakeTrayService } from './FakeTrayService';
import { DesktopRuntime } from './DesktopRuntime';

async function setup() {
  const repository = new InMemoryNoteRepository();
  unwrapResult(await repository.initializeVault());
  const workspace = createWorkspaceStore(repository);
  await workspace.getState().initialize();
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  const settings = createSettingsStore(settingsRepository);
  await settings.getState().load();
  const tray = new FakeTrayService();
  const shortcuts = new FakeGlobalShortcutService();
  const runtime = new DesktopRuntime(workspace, settings, shortcuts, tray);
  return { runtime, workspace, settings, repository, settingsRepository, tray, shortcuts };
}

describe('desktop lifecycle', () => {
  it('registers both shortcuts and keeps the current note when toggling open', async () => {
    const { runtime, workspace, shortcuts, tray } = await setup();
    await runtime.connect();
    unwrapResult(await runtime.quickNote());
    const path = workspace.getState().openDraft?.note.relativePath;
    unwrapResult(await runtime.toggle());
    expect(tray.actions.at(-1)).toBe('hide');
    shortcuts.registrations.get('open')?.pressed();
    await vi.waitFor(() => expect(tray.actions.at(-1)).toBe('focus-editor'));
    expect(workspace.getState().openDraft?.note.relativePath).toBe(path);
    expect(shortcuts.current).toBe('Ctrl+Alt+N');
    expect(shortcuts.registrations.get('open')?.shortcut).toBe('Ctrl+Alt+A');
    await runtime.stop();
    workspace.getState().pauseAutoSave();
  });

  it.each(['quickNoteShortcut', 'openShortcut'] as const)(
    'rejects an Anehalo conflict from %s before persisting it',
    async (setting) => {
      const { runtime, shortcuts, settingsRepository, workspace } = await setup();
      await runtime.connect();
      const value = setting === 'quickNoteShortcut' ? 'Alt+Control+A' : 'Alt+Control+N';
      const result = await runtime.updateSettings({ [setting]: value });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected a shortcut conflict.');
      expect(result.error.code).toBe('conflict');
      expect(result.error.message).toContain('different shortcuts');
      expect(shortcuts.current).toBe('Ctrl+Alt+N');
      expect(shortcuts.registrations.get('open')?.shortcut).toBe('Ctrl+Alt+A');
      expect(unwrapResult(await settingsRepository.load()).openShortcut).toBe('Ctrl+Alt+A');
      await runtime.stop();
      workspace.getState().pauseAutoSave();
    },
  );

  it('handles forwarded arguments in a running instance without changing the open action into a new note', async () => {
    const { runtime, workspace, tray } = await setup();
    await runtime.connect();
    unwrapResult(await runtime.quickNote());
    const first = workspace.getState().openDraft?.note.relativePath;
    unwrapResult(await runtime.toggle());
    const open = await tray.events?.arguments?.(['--open']);
    expect(open?.ok).toBe(true);
    expect(workspace.getState().openDraft?.note.relativePath).toBe(first);
    expect(tray.visibility.focused).toBe(true);
    const created = await tray.events?.arguments?.(['--new-note']);
    expect(created?.ok).toBe(true);
    expect(workspace.getState().openDraft?.note.relativePath).not.toBe(first);
    await runtime.stop();
    workspace.getState().pauseAutoSave();
  });

  it('delivers a cold-start action once after loading the remembered note', async () => {
    const { repository, settings, shortcuts, tray } = await setup();
    const remembered = unwrapResult(await repository.createNote({ title: 'Remembered' }));
    const workspace = createWorkspaceStore(repository, {
      lastOpenedNotePath: remembered.relativePath,
    });
    const runtime = new DesktopRuntime(workspace, settings, shortcuts, tray);
    tray.pendingArguments = [['--new-note']];
    const initialized = vi.spyOn(workspace.getState(), 'initialize');
    const initializing = workspace.getState().initialize();
    await runtime.connect();
    await initializing;
    expect(initialized).toHaveBeenCalled();
    expect(workspace.getState().tree.notes).toHaveLength(3);
    expect(workspace.getState().openDraft?.note.title).toBe('Untitled note');
    await runtime.stop();
    await runtime.connect();
    expect(workspace.getState().tree.notes).toHaveLength(3);
    await runtime.stop();
    workspace.getState().pauseAutoSave();
  });

  it('flushes the latest draft before the open shortcut hides the window and preserves it on reopen', async () => {
    const { runtime, repository, workspace, tray } = await setup();
    unwrapResult(await runtime.quickNote());
    const draft = workspace.getState().openDraft;
    if (!draft) throw new Error('Expected an open note.');
    workspace.getState().updateNoteContent(draft.identifier, 'Save before toggling.');
    const hide = vi.spyOn(tray, 'hide').mockImplementation(async () => {
      expect(unwrapResult(await repository.readNote(draft.note.relativePath)).content).toBe(
        'Save before toggling.',
      );
      tray.visibility = { visible: false, minimized: false, focused: false };
      return { ok: true, value: undefined };
    });
    await Promise.all([runtime.toggle(), runtime.toggle()]);
    expect(hide).toHaveBeenCalledOnce();
    expect(tray.visibility.focused).toBe(true);
    expect(workspace.getState().openDraft?.note.relativePath).toBe(draft.note.relativePath);
    workspace.getState().pauseAutoSave();
  });

  it('restores both registrations after a failed settings save', async () => {
    const { runtime, workspace, shortcuts, settingsRepository } = await setup();
    await runtime.connect();
    settingsRepository.file.writeError = new Error('Disk full');
    expect(
      (
        await runtime.updateSettings({
          quickNoteShortcut: 'Ctrl+Shift+J',
          openShortcut: 'Ctrl+Alt+O',
        })
      ).ok,
    ).toBe(false);
    expect(shortcuts.current).toBe('Ctrl+Alt+N');
    expect(shortcuts.registrations.get('open')?.shortcut).toBe('Ctrl+Alt+A');
    await runtime.stop();
    workspace.getState().pauseAutoSave();
  });

  it('restores both shortcuts if only one registration can be released while quitting', async () => {
    const { runtime, workspace, shortcuts, tray } = await setup();
    await runtime.connect();
    const unregister = shortcuts.unregister.bind(shortcuts);
    vi.spyOn(shortcuts, 'unregister').mockImplementation((pressed, action) =>
      action === 'open'
        ? Promise.resolve(failure({ code: 'io-error', message: 'Cannot release Open Anehalo.' }))
        : unregister(pressed, action),
    );
    expect((await runtime.close(true)).ok).toBe(false);
    expect(shortcuts.current).toBe('Ctrl+Alt+N');
    expect(shortcuts.registrations.get('open')?.shortcut).toBe('Ctrl+Alt+A');
    expect(tray.actions).not.toContain('quit');
    workspace.getState().pauseAutoSave();
  });

  it('shows the window, creates a note and focuses the editor on every hotkey action', async () => {
    const { runtime, workspace, tray } = await setup();
    const initialize = vi.spyOn(workspace.getState(), 'initialize');
    unwrapResult(await runtime.quickNote());
    const first = workspace.getState().openDraft?.note.relativePath;
    unwrapResult(await runtime.quickNote());
    expect(workspace.getState().openDraft?.note.relativePath).not.toBe(first);
    expect(tray.actions).toEqual(['show', 'focus-editor', 'show', 'focus-editor']);
    expect(initialize).not.toHaveBeenCalled();
  });
  it('flushes pending content before hiding and displays the tray notice only once, including after restart', async () => {
    const { runtime, workspace, repository, tray, settingsRepository } = await setup();
    unwrapResult(await runtime.quickNote());
    const draft = workspace.getState().openDraft;
    if (!draft) throw new Error('Expected a draft');
    workspace.getState().updateNoteContent(draft.identifier, 'save before hiding');
    const hide = vi.spyOn(tray, 'hide').mockImplementation(async () => {
      expect(unwrapResult(await repository.readNote(draft.note.relativePath)).content).toBe(
        'save before hiding',
      );
      return { ok: true, value: undefined };
    });
    unwrapResult(await runtime.close(false));
    expect(hide).toHaveBeenCalledOnce();
    expect(runtime.state.getState().toast).toBe(
      'Anehalo is still running in the tray. Use Ctrl+Alt+N for a new note.',
    );
    runtime.clearNotice();
    unwrapResult(await runtime.close(false));
    expect(runtime.state.getState().toast).toBeNull();
    expect(
      unwrapResult(await new InMemorySettingsRepository(settingsRepository.file.content).load())
        .trayNoticeShown,
    ).toBe(true);
  });
  it.each([false, true])(
    'flushes and unregisters before quitting (force quit: %s)',
    async (forceQuit) => {
      const { runtime, settings, workspace, repository, tray, shortcuts } = await setup();
      if (!forceQuit) unwrapResult(await settings.getState().update({ keepRunningInTray: false }));
      unwrapResult(await runtime.quickNote());
      const draft = workspace.getState().openDraft;
      if (!draft) throw new Error('Expected a draft');
      workspace.getState().updateNoteContent(draft.identifier, 'final text');
      unwrapResult(await runtime.updateSettings({ quickNoteShortcut: 'Ctrl+Alt+N' }));
      const quit = vi.spyOn(tray, 'quit').mockImplementation(async () => {
        expect(unwrapResult(await repository.readNote(draft.note.relativePath)).content).toBe(
          'final text',
        );
        expect(shortcuts.current).toBeNull();
        return { ok: true, value: undefined };
      });
      unwrapResult(await runtime.close(forceQuit));
      expect(quit).toHaveBeenCalledOnce();
      expect(tray.actions).not.toContain('hide');
    },
  );
  it('keeps the window available if a pending save fails', async () => {
    const { runtime, workspace, tray } = await setup();
    vi.spyOn(workspace.getState(), 'flushNotes').mockResolvedValue(
      failure({ code: 'permission-denied', message: 'Cannot save' }),
    );
    expect((await runtime.close(true)).ok).toBe(false);
    expect(tray.actions).toEqual(['show']);
    expect(runtime.state.getState().error?.message).toBe('Cannot save');
    expect(workspace.getState().isClosing).toBe(false);
  });
  it('refreshes search from the vault on window focus', async () => {
    const { runtime, repository, workspace } = await setup();
    const note = unwrapResult(
      await repository.createNote({ title: 'Outside', content: 'focusrefreshword' }),
    );
    await runtime.refresh();
    await vi.waitFor(async () =>
      expect(await workspace.getState().searchIndex.search('focusrefreshword')).toHaveLength(1),
    );
    unwrapResult(await repository.deleteNote(note.relativePath));
    await runtime.refresh();
    await vi.waitFor(async () =>
      expect(await workspace.getState().searchIndex.search('focusrefreshword')).toHaveLength(0),
    );
  });
  it('persists settings, applies shortcut and autostart immediately, and rolls back OS changes when saving fails', async () => {
    const { runtime, settingsRepository, shortcuts, tray } = await setup();
    unwrapResult(
      await runtime.updateSettings({
        quickNoteShortcut: 'Ctrl+Shift+J',
        startWithWindows: true,
        userName: 'Akila',
        theme: 'dark',
        keepRunningInTray: false,
      }),
    );
    expect(shortcuts.current).toBe('Ctrl+Shift+J');
    expect(tray.autostart).toBe(true);
    expect(unwrapResult(await settingsRepository.load())).toMatchObject({
      quickNoteShortcut: 'Ctrl+Shift+J',
      startWithWindows: true,
      userName: 'Akila',
      theme: 'dark',
      keepRunningInTray: false,
    });
    settingsRepository.file.writeError = new Error('Disk full');
    expect(
      (await runtime.updateSettings({ quickNoteShortcut: 'Ctrl+Alt+M', startWithWindows: false }))
        .ok,
    ).toBe(false);
    expect(shortcuts.current).toBe('Ctrl+Shift+J');
    expect(tray.autostart).toBe(true);
  });
  it('does not persist a conflicting shortcut and leaves the previous shortcut active', async () => {
    const { runtime, shortcuts, settingsRepository } = await setup();
    unwrapResult(await runtime.updateSettings({ quickNoteShortcut: 'Ctrl+Shift+J' }));
    shortcuts.conflicts.add('Ctrl+Alt+M');
    const changed = await runtime.updateSettings({ quickNoteShortcut: 'Ctrl+Alt+M' });
    expect(changed.ok).toBe(false);
    expect(shortcuts.current).toBe('Ctrl+Shift+J');
    expect(unwrapResult(await settingsRepository.load()).quickNoteShortcut).toBe('Ctrl+Shift+J');
  });
});
