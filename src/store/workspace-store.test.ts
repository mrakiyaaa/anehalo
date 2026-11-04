import { describe, expect, it } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { createWorkspaceStore } from '@/store/workspace-store';
import { unwrapResult } from '@/test/repository-helpers';

describe('workspace persistence', () => {
  it('serializes capture saves and Quick note without losing or duplicating the draft', async () => {
    const repository = new InMemoryNoteRepository();
    const store = createWorkspaceStore(repository);
    unwrapResult(await store.getState().refreshTree());
    store.getState().updateCaptureDraft('First capture');
    const firstSave = store.getState().saveCapture();
    store.getState().updateCaptureDraft('Latest capture');
    const secondSave = store.getState().saveCapture();
    unwrapResult(await firstSave);
    unwrapResult(await secondSave);
    expect(unwrapResult(await repository.readNote('Untitled note.md')).content).toBe(
      'Latest capture',
    );
    store.getState().updateCaptureDraft('Flushed before starting a new note');
    unwrapResult(await store.getState().startQuickNote());
    expect(unwrapResult(await repository.readNote('Untitled note.md')).content).toBe(
      'Flushed before starting a new note',
    );
    expect(store.getState().capture.relativePath).toBe('Untitled note 2.md');
    expect(store.getState().tree.notes).toHaveLength(3);
  });

  it('tracks captured identities and selected folders through rename and trash', async () => {
    const repository = new InMemoryNoteRepository();
    const store = createWorkspaceStore(repository);
    unwrapResult(await store.getState().refreshTree());
    unwrapResult(await store.getState().createFolder('Work'));
    store.getState().selectFolder('Work');
    unwrapResult(await store.getState().startQuickNote());
    store.getState().updateCaptureDraft('Important text');
    unwrapResult(await store.getState().renameFolder('Work', 'Projects'));
    expect(store.getState().activeFolderPath).toBe('Projects');
    expect(store.getState().capture.relativePath).toBe('Projects/Untitled note.md');
    unwrapResult(await store.getState().renameNote('Projects/Untitled note.md', 'Plan'));
    expect(store.getState().capture.relativePath).toBe('Projects/Plan.md');
    store.getState().updateCaptureDraft('Latest important text');
    const deleted = unwrapResult(await store.getState().deleteFolder('Projects'));
    expect(store.getState().capture.draft).toBe('');
    expect(store.getState().activeFolderPath).toBeNull();
    expect(
      repository.memoryFileSystem
        .snapshot()
        .find((entry) => entry.relativePath === `${deleted.trashPath}/Plan.md`)?.content,
    ).toBe('Latest important text');
  });

  it('keeps an unsaved draft and reports typed save errors', async () => {
    const repository = new InMemoryNoteRepository();
    const store = createWorkspaceStore(repository);
    unwrapResult(await store.getState().refreshTree());
    unwrapResult(await store.getState().startQuickNote());
    store.getState().updateCaptureDraft('Keep this draft');
    repository.memoryFileSystem.failNext('write');
    const result = await store.getState().saveCapture();
    expect(result.ok).toBe(false);
    expect(store.getState().capture.status).toBe('error');
    expect(store.getState().capture.draft).toBe('Keep this draft');
    expect(store.getState().error?.code).toBe('io-error');
    unwrapResult(await store.getState().saveCapture());
    expect(store.getState().capture.status).toBe('saved');
  });
});
