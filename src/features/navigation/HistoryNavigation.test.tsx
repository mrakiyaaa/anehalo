import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HistoryNavigation } from './HistoryNavigation';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { WorkspaceContext } from '@/store/workspace-context';
import { unwrapResult } from '@/test/repository-helpers';

const stores: WorkspaceStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((store) => store.getState().pauseAutoSave());
});

async function setup() {
  const store = createWorkspaceStore(
    new InMemoryNoteRepository([
      { relativePath: 'First.md', type: 'file', content: '' },
      { relativePath: 'Second.md', type: 'file', content: '' },
    ]),
  );
  stores.push(store);
  await store.getState().initialize();
  unwrapResult(await store.getState().openNote('First.md'));
  unwrapResult(await store.getState().openNote('Second.md'));
  render(
    <WorkspaceContext.Provider value={store}>
      <input aria-label="Note title" />
      <HistoryNavigation />
    </WorkspaceContext.Provider>,
  );
  return store;
}

describe('history shortcuts', () => {
  it('Alt+Left pressed while a change is still finishing goes back once it is done', async () => {
    const store = await setup();
    act(() => store.setState({ isMutating: true }));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowLeft', altKey: true });
    act(() => store.setState({ isMutating: false }));

    await waitFor(() => expect(store.getState().openDraft?.note.relativePath).toBe('First.md'));
  });

  it('Alt+Left stays quiet while the app is closing', async () => {
    const store = await setup();
    act(() => store.getState().setClosing(true));

    fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true });

    await act(async () => {
      await store.getState().flushNotes();
    });
    expect(store.getState().openDraft?.note.relativePath).toBe('Second.md');
  });
});
