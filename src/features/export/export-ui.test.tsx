import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import '@/features/editor/MarkdownEditor';
import { AppProviders } from '@/app/providers/AppProviders';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from './InMemoryExportPlatform';
import { unwrapResult } from '@/test/repository-helpers';

async function setup() {
  const platform = new InMemoryExportPlatform();
  const repository = new InMemoryNoteRepository([
    { relativePath: 'Export note.md', type: 'file', content: '**Original**' },
  ]);
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  render(
    <AppProviders
      services={{
        settingsRepository,
        folderAccess: new InMemoryFolderAccess(),
        createNoteRepository: () => repository,
        createAttachmentRepository: () => new InMemoryAttachmentRepository(),
        createExportPlatform: () => platform,
      }}
    >
      <App />
    </AppProviders>,
  );
  await screen.findByRole('button', { name: 'Open Export note' });
  return { platform, repository, settingsRepository, user: userEvent.setup() };
}
describe('export entry points and notifications', () => {
  it('exports from a home card context menu without opening the note', async () => {
    const { platform, user } = await setup();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Export note' }));
    await user.click(await screen.findByRole('menuitem', { name: /Copy as Markdown/ }));
    expect(await screen.findByText('Copied as Markdown')).toBeInTheDocument();
    expect(platform.clipboard[0]?.text).toBe('# Export note\n\n**Original**');
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument();
  });
  it('offers all four actions from a sidebar note context menu', async () => {
    await setup();
    fireEvent.contextMenu(
      within(screen.getByRole('navigation', { name: 'Notes' })).getByRole('button', {
        name: 'Export note',
      }),
    );
    for (const label of [
      'Copy as Markdown',
      'Copy as rich text',
      'Save as Markdown (.md)',
      'Save as PDF',
    ])
      expect(
        await screen.findByRole('menuitem', { name: new RegExp(label.replace(/[().]/g, '\\$&')) }),
      ).toBeInTheDocument();
  });
  it('copies the current editor draft using Ctrl+Shift+C and opens the menu using Ctrl+Shift+E', async () => {
    const { platform, user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Open Export note' }));
    const content = await screen.findByRole('textbox', { name: 'Note content' });
    await waitFor(() => expect(content).toHaveFocus());
    await user.keyboard(' latest words');
    fireEvent.keyDown(content, { key: 'C', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(platform.clipboard[0]?.text).toContain('latest words'));
    fireEvent.keyDown(content, { key: 'E', ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole('menuitem', { name: 'Save as PDF' })).toBeInTheDocument();
  });
  it('shows a saved toast, reveals the file and remembers the export folder', async () => {
    const { platform, user, settingsRepository } = await setup();
    platform.destination = 'C:/Exports/Export note.md';
    const reveal = vi.spyOn(platform, 'revealFile');
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Export note' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save as Markdown (.md)' }));
    expect(await screen.findByText('Saved Markdown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show in folder' }));
    expect(reveal).toHaveBeenCalledWith(platform.destination);
    expect(unwrapResult(await settingsRepository.load()).lastExportFolder).toBe('C:/Exports');
  });
  it('cancellation has no toast and failures show an explicit error', async () => {
    const { platform, user } = await setup();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Export note' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save as Markdown (.md)' }));
    await waitFor(() => expect(screen.queryByLabelText('Export progress')).not.toBeInTheDocument());
    expect(screen.queryByLabelText('Dismiss export notification')).not.toBeInTheDocument();
    platform.destination = 'C:/Exports/Export note.md';
    platform.failWrites = true;
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Export note' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save as Markdown (.md)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save the file. Check that the folder is writable.',
    );
    expect(platform.bundles).toEqual([]);
  });
});
