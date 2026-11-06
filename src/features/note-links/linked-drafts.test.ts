import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { createNavigationHistory } from '@/store/navigation-history';
import { unwrapResult } from '@/test/repository-helpers';
import { LinkedNoteRepository } from './LinkedNoteRepository';
import { NoteLinkIndex } from './NoteLinkIndex';

const savers: NoteAutoSaver[] = [];
const stores: WorkspaceStore[] = [];
afterEach(() => {
  savers.splice(0).forEach((saver) => saver.pause());
  stores.splice(0).forEach((store) => store.getState().pauseAutoSave());
});
describe('links in live drafts', () => {
  it('reopens the last note while a startup index scan is still reading other notes', async () => {
    const source = new InMemoryNoteRepository([
      { relativePath: 'A.md', type: 'file', content: '', modifiedAt: 20 },
      { relativePath: 'B.md', type: 'file', content: '', modifiedAt: 10 },
    ]);
    const read = source.readNote.bind(source);
    let finishReading = () => {};
    const waiting = new Promise<void>((resolve) => {
      finishReading = resolve;
    });
    vi.spyOn(source, 'readNote').mockImplementation(async (path) => {
      if (path === 'A.md') await waiting;
      return read(path);
    });
    const store = createWorkspaceStore(source, { lastOpenedNotePath: 'B.md' });
    stores.push(store);
    const initializing = store.getState().initialize();
    try {
      await vi.waitFor(() => expect(store.getState().openDraft?.note.relativePath).toBe('B.md'));
      const draft = store.getState().openDraft!;
      store.getState().updateNoteContent(draft.identifier, 'Typing while indexing');
      expect(store.getState().openDraft?.content).toBe('Typing while indexing');
    } finally {
      finishReading();
      await initializing;
    }
  });
  it('rebases links while retaining unsaved typing and the normal save queue', async () => {
    const source = new InMemoryNoteRepository([
      { relativePath: 'Source.md', type: 'file', content: '[Target](Target.md)' },
      { relativePath: 'Target.md', type: 'file', content: '' },
    ]);
    const repository = new LinkedNoteRepository(
      source,
      new NoteLinkIndex(),
      (rename, notes) => saver.acceptLinkRename(rename, notes),
      vi.fn(),
    );
    const saver = new NoteAutoSaver(repository);
    savers.push(saver);
    const draft = unwrapResult(await saver.load('Source.md'));
    const target = unwrapResult(await saver.load('Target.md'));
    saver.update(draft.identifier, {
      content: '[Target](Target.md) unsaved words [alias](Target.md)',
    });
    saver.update(target.identifier, { title: 'Renamed' });
    unwrapResult(await saver.flush(target.identifier));
    expect(saver.get(draft.identifier)?.content).toBe(
      '[Renamed](Renamed.md) unsaved words [alias](Renamed.md)',
    );
    expect(saver.get(draft.identifier)?.dirty).toBe(true);
    expect(saver.get(draft.identifier)?.documentVersion).toBe(0);
    unwrapResult(await saver.flushAll());
    expect(unwrapResult(await source.readNote('Source.md')).content).toBe(
      '[Renamed](Renamed.md) unsaved words [alias](Renamed.md)',
    );
  });
  it('rewrites self links during a debounced title rename without losing the body', async () => {
    const source = new InMemoryNoteRepository([
      { relativePath: 'Old.md', type: 'file', content: '[Old](Old.md)' },
    ]);
    const store = createWorkspaceStore(source);
    stores.push(store);
    unwrapResult(await store.getState().openNote('Old.md'));
    const draft = store.getState().openDraft!;
    store.getState().updateNoteContent(draft.identifier, '[Old](Old.md) latest text');
    store.getState().updateNoteTitle(draft.identifier, 'New');
    unwrapResult(await store.getState().saveNote(draft.identifier));
    expect(store.getState().openDraft?.content).toBe('[New](New.md) latest text');
    expect(store.getState().openDraft?.dirty).toBe(false);
    expect(unwrapResult(await source.readNote('New.md')).content).toBe('[New](New.md) latest text');
  });
  it('updates an open source after folder rename and preserves unsaved text', async () => {
    const source = new InMemoryNoteRepository([
      { relativePath: 'Source.md', type: 'file', content: '[Target](Work/Target.md)' },
      { relativePath: 'Work/Target.md', type: 'file', content: '' },
    ]);
    const store = createWorkspaceStore(source);
    stores.push(store);
    unwrapResult(await store.getState().openNote('Source.md'));
    const draft = store.getState().openDraft!;
    store.getState().updateNoteContent(draft.identifier, '[Target](Work/Target.md) last words');
    unwrapResult(await store.getState().renameFolder('Work', 'Projects'));
    expect(store.getState().openDraft?.content).toBe('[Target](Projects/Target.md) last words');
    expect(unwrapResult(await source.readNote('Source.md')).content).toBe(
      '[Target](Projects/Target.md) last words',
    );
  });
  it('restores a broken note and its deleted parent folders', async () => {
    const store = createWorkspaceStore(new InMemoryNoteRepository());
    stores.push(store);
    const restored = unwrapResult(
      await store.getState().restoreLinkedNote('Projects/Nested/Again.md'),
    );
    expect(restored.relativePath).toBe('Projects/Nested/Again.md');
    expect(restored.content).toBe('');
    expect(
      unwrapResult(await store.getState().restoreLinkedNote('Projects/Nested/Again.md'))
        .relativePath,
    ).toBe(restored.relativePath);
    expect((await store.getState().restoreLinkedNote('../Outside.md')).ok).toBe(false);
  });
  it('flushes pending edits before navigation and follows renamed history paths', async () => {
    const source = new InMemoryNoteRepository([
      { relativePath: 'A.md', type: 'file', content: '' },
      { relativePath: 'B.md', type: 'file', content: '' },
    ]);
    const store = createWorkspaceStore(source);
    stores.push(store);
    unwrapResult(await store.getState().openNote('A.md'));
    const first = store.getState().openDraft!;
    store.getState().updateNoteContent(first.identifier, 'Before following the link');
    unwrapResult(await store.getState().openNote('B.md'));
    expect(unwrapResult(await source.readNote('A.md')).content).toBe('Before following the link');
    unwrapResult(await store.getState().renameNote('A.md', 'Renamed A'));
    unwrapResult(await store.getState().navigateHistory(-1));
    expect(store.getState().openDraft?.note.relativePath).toBe('Renamed A.md');
    unwrapResult(await store.getState().navigateHistory(1));
    expect(store.getState().openDraft?.note.relativePath).toBe('B.md');
  });
});

describe('navigation history', () => {
  it('supports back, forward, duplicate visits and branching', () => {
    const history = createNavigationHistory();
    const visit = history.getState().visit;
    visit('A.md');
    visit('B.md');
    visit('B.md');
    visit('C.md');
    expect(history.getState().move(-1)).toBe('B.md');
    expect(history.getState().move(-1)).toBe('A.md');
    expect(history.getState().move(-1)).toBeNull();
    expect(history.getState().move(1)).toBe('B.md');
    visit('D.md');
    expect(history.getState().paths).toEqual(['A.md', 'B.md', 'D.md']);
    expect(history.getState().move(1)).toBeNull();
  });
});
