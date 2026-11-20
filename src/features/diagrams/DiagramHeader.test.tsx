import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ItemHeader } from '@/components/layout/ItemHeader';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile, sceneWith } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { DiagramTitleField } from './DiagramTitleField';

/** The diagram screen's header without the canvas, which needs a real browser. */
function DiagramHeader() {
  const diagram = useWorkspaceStore((state) => state.diagram);
  if (!diagram) return null;
  return (
    <ItemHeader status={diagram.status} folder={diagram.summary.folder}>
      <DiagramTitleField key={diagram.identifier} diagram={diagram.summary} disabled={false} />
    </ItemHeader>
  );
}

const stores: WorkspaceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
});

async function setup() {
  const rendered = await renderWorkspace(
    [
      { relativePath: 'Work', type: 'directory' },
      { relativePath: 'Idea.md', type: 'file', content: 'An idea' },
      { relativePath: 'Work/Flow.excalidraw', type: 'file', content: diagramFile('start') },
    ],
    <DiagramHeader />,
  );
  stores.push(rendered.store);
  unwrapResult(await rendered.store.getState().openItem('Idea.md'));
  unwrapResult(await rendered.store.getState().openItem('Work/Flow.excalidraw'));
  return { ...rendered, user: userEvent.setup() };
}

const title = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Diagram title' });

describe('diagram header', () => {
  it('shows the title, folder, save status and history buttons of the open diagram', async () => {
    const { store } = await setup();
    expect(await screen.findByRole('textbox', { name: 'Diagram title' })).toHaveValue('Flow');
    expect(screen.getByTitle('Work')).toHaveTextContent('Work');
    expect(screen.getByRole('status')).toHaveTextContent('Saved just now');
    const history = screen.getByRole('group', { name: 'History' });
    expect(within(history).getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(within(history).getByRole('button', { name: 'Forward' })).toBeDisabled();

    store.getState().updateDiagram(sceneWith('start', 'end'));
    expect(await screen.findByRole('status')).toHaveTextContent('Saving...');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved just now'));
  });

  it('renames the file when the title is committed with Enter', async () => {
    const { store, user } = await setup();
    await user.clear(await screen.findByRole('textbox', { name: 'Diagram title' }));
    await user.type(title(), 'Pipeline{Enter}');
    await waitFor(() =>
      expect(store.getState().diagram?.summary.relativePath).toBe('Work/Pipeline.excalidraw'),
    );
    expect(title()).toHaveValue('Pipeline');
    expect(title()).not.toHaveFocus();
  });

  it('shows why a rename failed and keeps the file name', async () => {
    const { store, files, user } = await setup();
    await user.clear(await screen.findByRole('textbox', { name: 'Diagram title' }));
    await user.type(title(), 'Pipeline');
    files.failNext('rename');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not rename the diagram.');
    expect(title()).toHaveAttribute('aria-invalid', 'true');
    expect(store.getState().diagram?.summary.relativePath).toBe('Work/Flow.excalidraw');
  });

  it('goes back to the note it came from', async () => {
    const { store, user } = await setup();
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() => expect(store.getState().view).toBe('editor'));
    expect(store.getState().openDraft?.note.relativePath).toBe('Idea.md');
  });
});
