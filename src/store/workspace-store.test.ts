import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { unwrapResult } from '@/test/repository-helpers';

const stores: WorkspaceStore[] = [];
function workspace(repository = new InMemoryNoteRepository()) {
  const store = createWorkspaceStore(repository);
  stores.push(store);
  return { store, repository };
}
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
});

describe('workspace editor navigation', () => {
  it('updates the remembered path when a note is renamed or trashed from home', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Work/Plan.md', type: 'file', content: 'Plan' },
    ]);
    let remembered: string | null = null;
    const store = createWorkspaceStore(repository, {
      rememberNote: (path) => {
        remembered = path;
        return Promise.resolve();
      },
    });
    stores.push(store);
    unwrapResult(await store.getState().openNote('Work/Plan.md'));
    unwrapResult(await store.getState().goHome());
    unwrapResult(await store.getState().renameFolder('Work', 'Projects'));
    expect(remembered).toBe('Projects/Plan.md');
    unwrapResult(await store.getState().renameNote('Projects/Plan.md', 'Next plan'));
    expect(remembered).toBe('Projects/Next plan.md');
    unwrapResult(await store.getState().deleteNote('Projects/Next plan.md'));
    expect(remembered).toBeNull();
  });
  it('saves on note switch and on returning home', async () => {
    const { store, repository } = workspace();
    unwrapResult(await store.getState().startQuickNote());
    const first = store.getState().openDraft;
    if (!first) throw new Error('Missing first draft');
    store.getState().updateNoteContent(first.identifier, 'Saved before switching');
    unwrapResult(await store.getState().startQuickNote());
    expect(unwrapResult(await repository.readNote('Untitled note.md')).content).toBe(
      'Saved before switching',
    );
    const second = store.getState().openDraft;
    if (!second) throw new Error('Missing second draft');
    store.getState().updateNoteContent(second.identifier, 'Saved before home');
    unwrapResult(await store.getState().goHome());
    expect(store.getState().view).toBe('home');
    expect(unwrapResult(await repository.readNote('Untitled note 2.md')).content).toBe(
      'Saved before home',
    );
  });

  it('tracks the open note through folder rename, note rename, and trash', async () => {
    const { store, repository } = workspace();
    unwrapResult(await store.getState().createFolder('Work'));
    store.getState().selectFolder('Work');
    unwrapResult(await store.getState().startQuickNote());
    const draft = store.getState().openDraft;
    if (!draft) throw new Error('Missing draft');
    store.getState().updateNoteContent(draft.identifier, 'Important text');
    unwrapResult(await store.getState().renameFolder('Work', 'Projects'));
    expect(store.getState().openDraft?.note.relativePath).toBe('Projects/Untitled note.md');
    unwrapResult(await store.getState().renameNote('Projects/Untitled note.md', 'Plan'));
    expect(store.getState().openDraft?.note.relativePath).toBe('Projects/Plan.md');
    store.getState().updateNoteContent(draft.identifier, 'Latest important text');
    const deleted = unwrapResult(await store.getState().deleteFolder('Projects'));
    expect(store.getState().view).toBe('home');
    expect(store.getState().openDraft).toBeNull();
    expect(
      repository.memoryFileSystem
        .snapshot()
        .find((entry) => entry.relativePath === `${deleted.trashPath}/Plan.md`)?.content,
    ).toBe('Latest important text');
  });

  it('retains failed drafts across navigation and saves them on a later flush', async () => {
    const { store, repository } = workspace();
    unwrapResult(await store.getState().startQuickNote());
    const first = store.getState().openDraft;
    if (!first) throw new Error('Missing draft');
    store.getState().updateNoteContent(first.identifier, 'Keep this draft');
    repository.memoryFileSystem.failNext('write');
    unwrapResult(await store.getState().goHome());
    expect(store.getState().pendingDrafts[0]?.content).toBe('Keep this draft');
    unwrapResult(await store.getState().flushNotes());
    expect(unwrapResult(await repository.readNote('Untitled note.md')).content).toBe(
      'Keep this draft',
    );
    expect(store.getState().pendingDrafts).toEqual([]);
  });

  it('restores the last note and honors the preference to start at home', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Last.md', type: 'file', content: 'Welcome back' },
    ]);
    const restored = createWorkspaceStore(repository, { lastOpenedNotePath: 'Last.md' });
    stores.push(restored);
    await restored.getState().initialize();
    expect(restored.getState().openDraft?.content).toBe('Welcome back');
    const home = createWorkspaceStore(repository, {
      lastOpenedNotePath: 'Last.md',
      reopenLastNote: false,
    });
    stores.push(home);
    await home.getState().initialize();
    expect(home.getState().view).toBe('home');
  });

  it('keeps deleted-file drafts reachable after going home', async () => {
    const { store, repository } = workspace();
    unwrapResult(await store.getState().startQuickNote());
    const draft = store.getState().openDraft;
    if (!draft) throw new Error('Missing draft');
    store.getState().updateNoteContent(draft.identifier, 'Do not lose me');
    unwrapResult(await repository.deleteNote(draft.note.relativePath));
    await store.getState().checkOpenNote();
    expect(store.getState().openDraft?.isMissing).toBe(true);
    unwrapResult(await store.getState().goHome());
    unwrapResult(await store.getState().openNote(draft.note.relativePath));
    expect(store.getState().openDraft?.content).toBe('Do not lose me');
    expect(store.getState().openDraft?.isMissing).toBe(true);
  });
});
