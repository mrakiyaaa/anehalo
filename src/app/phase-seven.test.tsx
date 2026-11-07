import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import '@/features/editor/MarkdownEditor';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { unwrapResult } from '@/test/repository-helpers';

async function setup() {
  const repository = new InMemoryNoteRepository();
  unwrapResult(await repository.initializeVault());
  unwrapResult(
    await repository.createNote({ title: 'Language notebook', content: 'සිංහල தமிழ் café café' }),
  );
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  const tray = new FakeTrayService();
  const shortcuts = new FakeGlobalShortcutService();
  const folderAccess = new InMemoryFolderAccess();
  const nextRepository = new InMemoryNoteRepository();
  render(
    <AppProviders
      services={{
        settingsRepository,
        desktop: { tray, shortcuts },
        folderAccess,
        createNoteRepository: (path) => (path === 'Memory/Other' ? nextRepository : repository),
        createAttachmentRepository: () => new InMemoryAttachmentRepository(),
        createExportPlatform: () => new InMemoryExportPlatform(),
      }}
    >
      <App />
    </AppProviders>,
  );
  await screen.findByRole('heading', { name: 'Language notebook' });
  return { user: userEvent.setup(), repository, settingsRepository, tray, shortcuts, folderAccess };
}

describe('Phase 7 keyboard and settings flows', () => {
  it('opens search with Ctrl+K and sidebar focus, selects the first result, navigates, and opens the editor', async () => {
    const { user } = await setup();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox', { name: 'Search all notes' });
    await user.type(input, 'தமிழ்');
    const option = await screen.findByRole('option', { selected: true });
    expect(option).toHaveTextContent('Language notebook');
    await waitFor(() => expect(option.querySelector('mark')).toHaveTextContent('தமிழ்'));
    await user.keyboard('{Enter}');
    const editor = await screen.findByRole('textbox', { name: 'Note content' });
    await waitFor(() => expect(editor).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const search = await screen.findByRole('combobox', { name: 'Search all notes' });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    const first = search.getAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    expect(search.getAttribute('aria-activedescendant')).not.toBe(first);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('searchbox', { name: 'Search notes' }));
    expect(await screen.findByRole('combobox', { name: 'Search all notes' })).toHaveFocus();
  });

  it('finds in the editor with counts, next, previous, wraparound, and Escape', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Open Language notebook' }));
    await screen.findByRole('textbox', { name: 'Note content' });
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = await screen.findByRole('searchbox', { name: 'Find in note' });
    await user.type(input, 'cafe');
    expect(screen.getByRole('search', { name: 'Find in note' })).toHaveTextContent('1 / 2');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('search', { name: 'Find in note' })).toHaveTextContent('2 / 2');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('search', { name: 'Find in note' })).toHaveTextContent('1 / 2');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(screen.getByRole('search', { name: 'Find in note' })).toHaveTextContent('2 / 2');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('search', { name: 'Find in note' })).not.toBeInTheDocument();
    expect(document.querySelector('.find-match')).toBeNull();
  });

  it('applies general settings, records shortcuts, and reports conflicts without losing the active shortcut', async () => {
    const { user, shortcuts, settingsRepository } = await setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Your name' }), 'Akila');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Theme' }), 'dark');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Reopen last note on launch' }));
    const input = within(dialog).getByRole('textbox', { name: 'Record quick note shortcut' });
    await user.click(input);
    fireEvent.keyDown(input, { key: 'j', code: 'KeyJ', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(shortcuts.current).toBe('Ctrl+Shift+J'));
    shortcuts.conflicts.add('Ctrl+Alt+M');
    fireEvent.keyDown(input, { key: 'm', code: 'KeyM', ctrlKey: true, altKey: true });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already taken');
    expect(shortcuts.current).toBe('Ctrl+Shift+J');
    await waitFor(async () =>
      expect(unwrapResult(await settingsRepository.load())).toMatchObject({
        userName: 'Akila',
        theme: 'dark',
        reopenLastNote: false,
        quickNoteShortcut: 'Ctrl+Shift+J',
      }),
    );
  });

  it('requires in-app confirmation before changing the vault and leaves original files in place', async () => {
    const { user, folderAccess, settingsRepository, repository } = await setup();
    folderAccess.selection = 'Memory/Other';
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const confirmation = await screen.findByRole('alertdialog', { name: 'Switch notes folder?' });
    expect(unwrapResult(await settingsRepository.load()).vaultPath).toBe('Memory/Anehalo');
    await user.click(within(confirmation).getByRole('button', { name: 'Switch folder' }));
    await waitFor(async () =>
      expect(unwrapResult(await settingsRepository.load()).vaultPath).toBe('Memory/Other'),
    );
    expect(unwrapResult(await repository.readNote('Language notebook.md')).content).toContain(
      'தமிழ்',
    );
    expect(folderAccess.validatedPaths).toContain('Memory/Other');
  });

  it('dispatches the registered hotkey while the window is in the tray', async () => {
    const { tray, shortcuts } = await setup();
    await waitFor(() => expect(shortcuts.pressed).toBeTypeOf('function'));
    await act(async () => {
      tray.events?.close();
      await Promise.resolve();
    });
    await waitFor(() => expect(tray.actions).toContain('hide'));
    act(() => {
      shortcuts.pressed?.();
    });
    expect(await screen.findByRole('textbox', { name: 'Note title' })).toHaveValue('Untitled note');
    await waitFor(() => expect(tray.actions).toEqual(['hide', 'show', 'focus-editor']));
  });
});
