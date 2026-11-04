import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';

async function renderWorkspace() {
  const repository = new InMemoryNoteRepository();
  render(
    <AppProviders repository={repository}>
      <App />
    </AppProviders>,
  );
  await screen.findByRole('heading', { name: 'Welcome' });
  return repository;
}

describe('vault home', () => {
  it('loads the welcome note and real repository totals', async () => {
    await renderWorkspace();
    expect(screen.getByRole('banner')).toHaveTextContent('Anehalo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Good (morning|afternoon|evening)/,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('1 note · 1 folder');
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('creates a folder inline, creates a note there, and saves capture text', async () => {
    const user = userEvent.setup();
    const repository = await renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder name' }), 'Work');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    await user.click(await screen.findByRole('button', { name: 'Work, 0 notes' }));
    await user.click(screen.getByRole('button', { name: 'Quick note' }));
    await screen.findByRole('heading', { name: 'Untitled note' });
    const capture = screen.getByRole('textbox', { name: 'Quick capture' });
    await waitFor(() => expect(capture).toHaveFocus());
    await user.type(capture, 'A real saved thought');
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved just now'));
    expect(unwrapResult(await repository.readNote('Work/Untitled note.md')).content).toBe(
      'A real saved thought',
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'no-match');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('renames and trashes notes through in-app dialogs, with cancellation', async () => {
    const user = userEvent.setup();
    const repository = await renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'Actions for Welcome' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename note' });
    const title = within(dialog).getByRole('textbox', { name: 'Note title' });
    await user.clear(title);
    await user.type(title, 'First note');
    await user.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await screen.findByRole('heading', { name: 'First note' });
    await user.click(screen.getByRole('button', { name: 'Actions for First note' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to trash' }));
    let confirmation = await screen.findByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(unwrapResult(await repository.readNote('Getting started/First note.md')).title).toBe(
      'First note',
    );
    await user.click(screen.getByRole('button', { name: 'Actions for First note' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to trash' }));
    confirmation = await screen.findByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Move to trash' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'First note' })).not.toBeInTheDocument(),
    );
    expect(
      repository.memoryFileSystem
        .snapshot()
        .some(
          (entry) =>
            entry.relativePath.startsWith('.trash/') &&
            entry.relativePath.endsWith('/First note.md'),
        ),
    ).toBe(true);
  });

  it('loads external changes when window focus returns', async () => {
    const repository = await renderWorkspace();
    unwrapResult(
      await repository.createNote({ title: 'External note', content: 'Changed elsewhere' }),
    );
    window.dispatchEvent(new Event('focus'));
    await screen.findByRole('heading', { name: 'External note' });
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});
