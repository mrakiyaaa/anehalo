import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile } from '@/test/diagram-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { SidebarItems } from './SidebarItems';

const vault: readonly MemoryEntry[] = [
  { relativePath: 'Archive', type: 'directory' },
  { relativePath: 'Idea.md', type: 'file', content: 'An idea', modifiedAt: 2 },
  { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start'), modifiedAt: 3 },
];

const stores: WorkspaceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
});

async function setup() {
  const rendered = await renderWorkspace(vault, <SidebarItems />);
  stores.push(rendered.store);
  const items = screen.getByRole('navigation', { name: 'Items' });
  return { ...rendered, items, user: userEvent.setup() };
}

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  items: HTMLElement,
  name: string,
) {
  await user.click(within(items).getByRole('button', { name: `Actions for ${name}` }));
  return screen.findByRole('menu');
}

describe('sidebar items', () => {
  it('lists notes and diagrams together, newest first, each with its own icon', async () => {
    const { items } = await setup();
    const buttons = within(items).getAllByRole('button', { name: /^(Flow|Idea)$/ });
    expect(buttons.map((button) => button.textContent)).toEqual(['Flow', 'Idea']);
    expect(
      buttons.map((button) => button.querySelector('[data-icon]')?.getAttribute('data-icon')),
    ).toEqual(['shapes', 'pen']);
  });

  it('opens a diagram and marks it as the current item', async () => {
    const { items, store, user } = await setup();
    await user.click(within(items).getByRole('button', { name: 'Flow' }));
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
    expect(within(items).getByRole('button', { name: 'Flow' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('offers Open, Rename, Move, Show in File Explorer and trash for a diagram', async () => {
    const { items, user } = await setup();
    const menu = await openMenu(user, items, 'Flow');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Open', 'Rename', 'Move…', 'Show in File Explorer', 'Move to trash']);
  });

  it('renames, moves, reveals and trashes a diagram from its menu', async () => {
    const { items, store, files, fileExplorer, user } = await setup();
    await user.click(within(await openMenu(user, items, 'Flow')).getByText('Rename'));
    const rename = screen.getByRole('dialog', { name: 'Rename diagram' });
    await user.clear(within(rename).getByRole('textbox', { name: 'Diagram title' }));
    await user.type(within(rename).getByRole('textbox', { name: 'Diagram title' }), 'Pipeline');
    await user.click(within(rename).getByRole('button', { name: 'Save name' }));
    await waitFor(() =>
      expect(within(items).getByRole('button', { name: 'Pipeline' })).toBeVisible(),
    );

    await user.click(within(await openMenu(user, items, 'Pipeline')).getByText('Move…'));
    const move = screen.getByRole('dialog', { name: 'Move diagram' });
    await user.selectOptions(within(move).getByRole('combobox', { name: 'Folder' }), 'Archive');
    await user.click(within(move).getByRole('button', { name: 'Move' }));
    await waitFor(() =>
      expect(store.getState().tree.diagrams.map((item) => item.relativePath)).toEqual([
        'Archive/Pipeline.excalidraw',
      ]),
    );

    await user.click(
      within(await openMenu(user, items, 'Pipeline')).getByText('Show in File Explorer'),
    );
    expect(fileExplorer.revealed).toEqual(['Memory\\Anehalo\\Archive\\Pipeline.excalidraw']);

    await user.click(within(await openMenu(user, items, 'Pipeline')).getByText('Move to trash'));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Move to trash' }),
    );
    await waitFor(() => expect(store.getState().tree.diagrams).toEqual([]));
    expect(
      files
        .snapshot()
        .some((entry) => /^\.trash\/.+\/Archive\/Pipeline\.excalidraw$/.test(entry.relativePath)),
    ).toBe(true);
  });

  it('keeps Move off the note menu, since moving notes would break their links', async () => {
    const { items, user } = await setup();
    const menu = await openMenu(user, items, 'Idea');
    expect(within(menu).queryByText('Move…')).not.toBeInTheDocument();
    expect(within(menu).getByText('Show in File Explorer')).toBeVisible();
  });
});
