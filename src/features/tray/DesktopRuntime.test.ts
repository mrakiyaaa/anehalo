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
  it('shows the window, creates a note and focuses the editor on every hotkey action', async () => {
    const { runtime, workspace, tray } = await setup();
    unwrapResult(await runtime.quickNote());
    const first = workspace.getState().openDraft?.note.relativePath;
    unwrapResult(await runtime.quickNote());
    expect(workspace.getState().openDraft?.note.relativePath).not.toBe(first);
    expect(tray.actions).toEqual(['show', 'focus-editor', 'show', 'focus-editor']);
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
