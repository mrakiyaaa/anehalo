import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile } from '@/test/diagram-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { FolderList } from './FolderList';

const stores: WorkspaceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
});

describe('folder list', () => {
  it('counts notes and diagrams, and creates a diagram from a folder menu', async () => {
    const { store } = await renderWorkspace(
      [
        { relativePath: 'Work', type: 'directory' },
        { relativePath: 'Work/Idea.md', type: 'file', content: 'An idea' },
        { relativePath: 'Work/Flow.excalidraw', type: 'file', content: diagramFile('start') },
        { relativePath: 'Plan.md', type: 'file', content: 'A plan' },
      ],
      <FolderList />,
    );
    stores.push(store);
    const user = userEvent.setup();
    const folders = screen.getByRole('navigation', { name: 'Folders' });
    expect(within(folders).getByRole('button', { name: 'All items, 3 items' })).toBeVisible();
    expect(within(folders).getByRole('button', { name: 'Work, 2 items' })).toBeVisible();

    await user.click(within(folders).getByRole('button', { name: 'Actions for Work' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New diagram here' }));

    await waitFor(() =>
      expect(store.getState().diagram?.summary.relativePath).toBe(
        'Work/Untitled diagram.excalidraw',
      ),
    );
    expect(store.getState().view).toBe('diagram');
    expect(await within(folders).findByRole('button', { name: 'Work, 3 items' })).toBeVisible();
  });
});
