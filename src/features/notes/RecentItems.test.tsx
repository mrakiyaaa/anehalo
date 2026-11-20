import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { MemoryThumbnailFiles } from '@/features/thumbnails/thumbnail-files';
import { ThumbnailCache, type Thumbnail } from '@/features/thumbnails/thumbnail-cache';
import { ThumbnailService } from '@/features/thumbnails/thumbnail-service';
import { useHomeFilterStore } from '@/store/home-filter-store';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile, fakeDiagramCodec } from '@/test/diagram-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { RecentItems } from './RecentItems';

const vault: readonly MemoryEntry[] = [
  { relativePath: 'Archive', type: 'directory' },
  { relativePath: 'Idea.md', type: 'file', content: 'An idea worth keeping', modifiedAt: 1 },
  { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start'), modifiedAt: 4 },
  { relativePath: 'Empty.excalidraw', type: 'file', content: diagramFile(), modifiedAt: 3 },
  { relativePath: 'Broken.excalidraw', type: 'file', content: '{"type":"excal', modifiedAt: 2 },
];

const stores: WorkspaceStore[] = [];
beforeEach(() => {
  useHomeFilterStore.getState().setFilter('all');
  URL.createObjectURL = () => 'blob:thumbnail';
  URL.revokeObjectURL = () => undefined;
});
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
});

/** Drawing waits for `release`, so a test can see the loading placeholder first. */
async function setup() {
  let release: () => void = () => undefined;
  const idle = new Promise<void>((resolve) => {
    release = resolve;
  });
  const rendered = await renderWorkspace(vault, <RecentItems />);
  stores.push(rendered.store);
  const image: Thumbnail = { state: 'image', bytes: new Uint8Array([1]), mimeType: 'image/png' };
  rendered.store.setState({
    thumbnails: new ThumbnailService({
      cache: new ThumbnailCache(new MemoryThumbnailFiles(), 'Memory/Anehalo'),
      diagrams: new DiagramRepository(rendered.repository.storage, () =>
        Promise.resolve(fakeDiagramCodec),
      ),
      render: (scene) => Promise.resolve(scene.elements.length === 0 ? { state: 'empty' } : image),
      waitForIdle: () => idle,
    }),
  });
  return { ...rendered, release, user: userEvent.setup() };
}

const card = (title: string) =>
  screen.getByRole('button', { name: `Open ${title}` }).closest('article') ?? document.body;

describe('Home items', () => {
  it('shows diagram cards from loading to their image, empty and error placeholders', async () => {
    const { release } = await setup();
    expect(await within(card('Flow')).findByText('Drawing preview…')).toBeVisible();

    release();
    expect(
      await within(card('Flow')).findByRole('img', { name: 'Preview of Flow' }),
    ).toHaveAttribute('src', 'blob:thumbnail');
    expect(await within(card('Empty')).findByText('Empty diagram')).toBeVisible();
    expect(await within(card('Broken')).findByText('Preview unavailable')).toBeVisible();
    expect(within(card('Idea')).getByText('An idea worth keeping')).toBeVisible();
  });

  it('filters by kind with the chips and remembers the choice in the store', async () => {
    const { user } = await setup();
    const chips = screen.getByRole('group', { name: 'Show' });
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('4 items · last edited first')).toBeVisible();

    await user.click(within(chips).getByRole('button', { name: 'Diagrams' }));
    expect(screen.queryByRole('button', { name: 'Open Idea' })).not.toBeInTheDocument();
    expect(screen.getByText('3 diagrams · last edited first')).toBeVisible();
    expect(useHomeFilterStore.getState().filter).toBe('diagrams');

    await user.click(within(chips).getByRole('button', { name: 'Notes' }));
    expect(screen.queryByRole('button', { name: 'Open Flow' })).not.toBeInTheDocument();
    expect(screen.getByText('1 note · last edited first')).toBeVisible();
  });

  it('offers the sidebar actions on a diagram card and moves the diagram', async () => {
    const { store, user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Flow' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Open', 'Rename', 'Move…', 'Show in File Explorer', 'Move to trash']);
    await user.click(within(menu).getByText('Move…'));
    const dialog = screen.getByRole('dialog', { name: 'Move diagram' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Folder' }), 'Archive');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));
    await waitFor(() =>
      expect(store.getState().tree.diagrams.map((item) => item.relativePath)).toContain(
        'Archive/Flow.excalidraw',
      ),
    );
  });
});
