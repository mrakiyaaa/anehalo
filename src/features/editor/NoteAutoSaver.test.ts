import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { failure } from '@/features/storage/repository-result';

const savers: NoteAutoSaver[] = [];
async function setup() {
  const repository = new InMemoryNoteRepository([
    { relativePath: 'First.md', type: 'file', content: 'Original', modifiedAt: 10 },
    { relativePath: 'Second.md', type: 'file', content: 'Second', modifiedAt: 20 },
  ]);
  const saver = new NoteAutoSaver(repository);
  savers.push(saver);
  const draft = unwrapResult(await saver.load('First.md'));
  const write = vi.spyOn(repository, 'writeNote');
  return { repository, saver, identifier: draft.identifier, write };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const saver of savers.splice(0)) saver.pause();
  vi.useRealTimers();
});

describe('debounced, ordered saves', () => {
  it('reports a disk-full error explicitly and keeps the dirty draft', async () => {
    const { saver, repository, identifier } = await setup();
    vi.spyOn(repository.memoryFileSystem, 'writeText').mockRejectedValueOnce(
      new Error('There is not enough space on the disk (os error 112)'),
    );
    saver.update(identifier, { content: 'Retain this draft' });
    expect(await saver.flushAll()).toMatchObject({ ok: false, error: { code: 'disk-full' } });
    expect(saver.get(identifier)).toMatchObject({ dirty: true, content: 'Retain this draft' });
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Original');
  });
  it.each(['write', 'rename'] as const)(
    'preserves the baseline and draft after disk full during %s',
    async (operation) => {
      const { saver, repository, identifier } = await setup();
      repository.memoryFileSystem.failNext(
        operation,
        'There is not enough space on the disk (os error 112)',
      );
      saver.update(identifier, { content: 'Keep my new text' });
      expect((await saver.flushAll()).ok).toBe(false);
      expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Original');
      expect(saver.get(identifier)).toMatchObject({
        dirty: true,
        content: 'Keep my new text',
        status: 'retrying',
      });
      expect(
        repository.memoryFileSystem.snapshot().some((entry) => entry.relativePath.endsWith('.tmp')),
      ).toBe(false);
      unwrapResult(await saver.flushAll());
      expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Keep my new text');
    },
  );
  it('a body blur does not prematurely commit a title the user just started editing', async () => {
    const { saver, identifier, repository } = await setup();
    saver.update(identifier, { content: 'Updated body' });
    const blurSave = saver.flushContent(identifier);
    saver.update(identifier, { title: '' });
    unwrapResult(await blurSave);
    expect(saver.get(identifier)?.title).toBe('');
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Updated body');
    saver.update(identifier, { title: 'My title' });
    await vi.advanceTimersByTimeAsync(499);
    expect(saver.get(identifier)?.note.relativePath).toBe('First.md');
    await vi.advanceTimersByTimeAsync(1);
    expect(saver.get(identifier)?.note.relativePath).toBe('My title.md');
  });
  it('turns many keystrokes into one write after 500ms', async () => {
    const { saver, identifier, write } = await setup();
    for (const content of ['A', 'A thought', 'A complete thought']) {
      saver.update(identifier, { content });
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(399);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledExactlyOnceWith('First.md', 'A complete thought');
    expect(saver.get(identifier)?.dirty).toBe(false);
  });

  it('flushes immediately for blur, without waiting for the timer', async () => {
    const { saver, identifier, repository } = await setup();
    saver.update(identifier, { content: 'Saved on blur' });
    unwrapResult(await saver.flush(identifier));
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Saved on blur');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips unchanged content, including an edit undone before the deadline', async () => {
    const { saver, identifier, write } = await setup();
    unwrapResult(await saver.flush(identifier));
    saver.update(identifier, { content: 'Temporary' });
    saver.update(identifier, { content: 'Original' });
    await vi.advanceTimersByTimeAsync(1000);
    unwrapResult(await saver.flushAll());
    expect(write).not.toHaveBeenCalled();
  });

  it('never lets an older in-flight write overwrite a newer edit', async () => {
    const { saver, repository, identifier, write } = await setup();
    const originalWrite = InMemoryNoteRepository.prototype.writeNote.bind(repository);
    let finishFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    write.mockImplementationOnce(async (path, content) => {
      await firstGate;
      return originalWrite(path, content);
    });
    saver.update(identifier, { content: 'Older edit' });
    const firstSave = saver.flush(identifier);
    await vi.advanceTimersByTimeAsync(0);
    saver.update(identifier, { content: 'Latest edit' });
    const latestSave = saver.flush(identifier);
    expect(write).toHaveBeenCalledTimes(1);
    finishFirst?.();
    unwrapResult(await firstSave);
    unwrapResult(await latestSave);
    expect(write.mock.calls.map((call) => call[1])).toEqual(['Older edit', 'Latest edit']);
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Latest edit');
    expect(saver.get(identifier)?.content).toBe('Latest edit');
    expect(saver.get(identifier)?.dirty).toBe(false);
  });

  it('retains text after a failure and retries with backoff', async () => {
    const { saver, repository, identifier, write } = await setup();
    repository.memoryFileSystem.failNext('write');
    saver.update(identifier, { content: 'Keep every word' });
    await vi.advanceTimersByTimeAsync(500);
    expect(saver.get(identifier)).toMatchObject({
      content: 'Keep every word',
      dirty: true,
      status: 'retrying',
    });
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Original');
    await vi.advanceTimersByTimeAsync(999);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(2);
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Keep every word');
    expect(saver.get(identifier)?.status).toBe('saved');
  });

  it('flushAll includes the very last words entered during a pending write', async () => {
    const { saver, identifier, repository, write } = await setup();
    const originalWrite = InMemoryNoteRepository.prototype.writeNote.bind(repository);
    write.mockImplementationOnce(async (path, content) => {
      saver.update(identifier, { content: 'The last words' });
      return originalWrite(path, content);
    });
    saver.update(identifier, { content: 'Earlier words' });
    unwrapResult(await saver.flushAll());
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('The last words');
  });
});

describe('external changes and filenames', () => {
  it('backs off from one second to two seconds across repeated failures', async () => {
    const { saver, identifier, write } = await setup();
    const unavailable = failure({ code: 'io-error', message: 'Disk temporarily unavailable' });
    write.mockResolvedValueOnce(unavailable).mockResolvedValueOnce(unavailable);
    saver.update(identifier, { content: 'Keep retrying safely' });
    await vi.advanceTimersByTimeAsync(500);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(write).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(3);
    expect(saver.get(identifier)?.dirty).toBe(false);
  });
  it('reloads a clean note when disk content changes', async () => {
    const { saver, repository, identifier } = await setup();
    unwrapResult(await repository.writeNote('First.md', 'From another app'));
    unwrapResult(await saver.checkExternal(identifier));
    expect(saver.get(identifier)).toMatchObject({
      content: 'From another app',
      dirty: false,
      documentVersion: 1,
    });
  });

  it('preserves dirty text and blocks writes until the conflict is resolved', async () => {
    const { saver, repository, identifier, write } = await setup();
    saver.update(identifier, { content: 'My text' });
    unwrapResult(await repository.writeNote('First.md', 'Their text'));
    expect((await saver.checkExternal(identifier)).ok).toBe(false);
    expect(saver.get(identifier)?.content).toBe('My text');
    expect(saver.get(identifier)?.externalNote?.content).toBe('Their text');
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).toHaveBeenCalledTimes(1);
    expect((await saver.flush(identifier)).ok).toBe(false);
    unwrapResult(await saver.resolveConflict(identifier, 'mine'));
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('My text');
  });

  it('Load theirs reads the latest disk version and explicitly discards the draft', async () => {
    const { saver, repository, identifier } = await setup();
    saver.update(identifier, { content: 'My text' });
    unwrapResult(await repository.writeNote('First.md', 'Their first change'));
    await saver.checkExternal(identifier);
    unwrapResult(await repository.writeNote('First.md', 'Their latest change'));
    unwrapResult(await saver.resolveConflict(identifier, 'theirs'));
    expect(saver.get(identifier)).toMatchObject({
      content: 'Their latest change',
      externalNote: null,
      dirty: false,
    });
  });

  it('also detects disk changes before a debounce save', async () => {
    const { saver, repository, identifier } = await setup();
    saver.update(identifier, { content: 'My text' });
    unwrapResult(await repository.writeNote('First.md', 'Disk text'));
    await vi.advanceTimersByTimeAsync(500);
    expect(saver.get(identifier)?.externalNote?.content).toBe('Disk text');
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Disk text');
  });

  it('does not recreate a file deleted or renamed outside the app', async () => {
    const { saver, repository, identifier } = await setup();
    saver.update(identifier, { content: 'My unsaved text' });
    unwrapResult(await repository.renameNote('First.md', 'Moved'));
    expect((await saver.checkExternal(identifier)).ok).toBe(false);
    expect(saver.get(identifier)).toMatchObject({
      isMissing: true,
      content: 'My unsaved text',
      dirty: true,
    });
    expect((await saver.flushAll()).ok).toBe(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect((await repository.readNote('First.md')).ok).toBe(false);
    expect(unwrapResult(await repository.readNote('Moved.md')).content).toBe('Original');
  });

  it('sanitizes title changes, suffixes duplicates, and saves subsequent edits at the new path', async () => {
    const { saver, repository, identifier } = await setup();
    unwrapResult(await repository.createNote({ title: 'Plan' }));
    saver.update(identifier, { title: '  Plan:*?  ', content: 'Preserved body' });
    await vi.advanceTimersByTimeAsync(500);
    expect(saver.get(identifier)?.note.relativePath).toBe('Plan 2.md');
    expect(saver.get(identifier)?.title).toBe('Plan 2');
    saver.update(identifier, { content: 'Updated body' });
    unwrapResult(await saver.flush(identifier));
    expect(unwrapResult(await repository.readNote('Plan 2.md')).content).toBe('Updated body');
    expect((await repository.readNote('First.md')).ok).toBe(false);
  });

  it('keeps a body that saved successfully when a title rename fails', async () => {
    const { saver, identifier, repository } = await setup();
    saver.update(identifier, { content: 'Body saved', title: 'CON' });
    expect((await saver.flush(identifier)).ok).toBe(false);
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Body saved');
    expect(saver.get(identifier)?.error?.code).toBe('invalid-name');
    saver.update(identifier, { title: 'Valid title' });
    unwrapResult(await saver.flush(identifier));
    expect(unwrapResult(await repository.readNote('Valid title.md')).content).toBe('Body saved');
  });

  it('recovers a deleted-file draft as a new note without replacing the external rename', async () => {
    const { saver, repository, identifier } = await setup();
    saver.update(identifier, { content: 'Recover these words' });
    unwrapResult(await repository.renameNote('First.md', 'External rename'));
    await saver.checkExternal(identifier);
    unwrapResult(await saver.recoverAsNewNote(identifier));
    expect(unwrapResult(await repository.readNote('External rename.md')).content).toBe('Original');
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Recover these words');
    expect(saver.get(identifier)).toMatchObject({
      dirty: false,
      isMissing: false,
      status: 'saved',
    });
  });
});

describe('title editing', () => {
  it('renames nothing while typing, then once after the field has been quiet', async () => {
    const { saver, identifier, repository } = await setup();
    const rename = vi.spyOn(repository, 'renameNote');
    for (const text of ['M', 'My', 'My ti', 'My title']) {
      saver.editTitle(identifier, text);
      await vi.advanceTimersByTimeAsync(700);
    }
    expect(rename).not.toHaveBeenCalled();
    // What is typed is not in the draft, so no store update can echo it back into the field.
    expect(saver.get(identifier)).toMatchObject({ title: 'First', dirty: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(saver.get(identifier)?.note.relativePath).toBe('My title.md');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never lets the idle timer commit an emptied title, but commits it on request', async () => {
    const { saver, identifier, repository } = await setup();
    const rename = vi.spyOn(repository, 'renameNote');
    saver.editTitle(identifier, '');
    saver.editTitle(identifier, ' ... ');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rename).not.toHaveBeenCalled();
    expect(saver.get(identifier)?.note.relativePath).toBe('First.md');
    unwrapResult(await saver.commitTitle(identifier, ''));
    expect(saver.get(identifier)?.note.relativePath).toBe('Untitled note.md');
  });

  it('falls back to the next free "Untitled note" name', async () => {
    const { saver, identifier, repository } = await setup();
    unwrapResult(await repository.createNote({ title: 'Untitled note' }));
    unwrapResult(await saver.commitTitle(identifier, ''));
    expect(saver.get(identifier)).toMatchObject({
      title: 'Untitled note 2',
      note: { relativePath: 'Untitled note 2.md' },
    });
  });

  it('does not rename for the note’s own name, however it is spelled', async () => {
    const { saver, identifier, repository } = await setup();
    const rename = vi.spyOn(repository, 'renameNote');
    for (const text of ['First', '  First  ', 'First.md']) {
      unwrapResult(await saver.commitTitle(identifier, text));
    }
    expect(rename).not.toHaveBeenCalled();
    expect(saver.get(identifier)).toMatchObject({ title: 'First', dirty: false });
  });

  it('treats a case-only change as the same file, not a clash', async () => {
    const { saver, identifier } = await setup();
    unwrapResult(await saver.commitTitle(identifier, 'first'));
    expect(saver.get(identifier)).toMatchObject({
      title: 'first',
      note: { relativePath: 'first.md' },
    });
  });

  it('numbers a name that another note uses', async () => {
    const { saver, identifier } = await setup();
    unwrapResult(await saver.commitTitle(identifier, 'Second'));
    expect(saver.get(identifier)?.note.relativePath).toBe('Second 2.md');
  });

  it('commits typing that is still pending on flush, but not for body auto-save or a body blur', async () => {
    const { saver, identifier, repository } = await setup();
    saver.editTitle(identifier, 'Typing');
    saver.update(identifier, { content: 'Body' });
    await vi.advanceTimersByTimeAsync(600);
    // The body timer fired and saved the body, leaving the title alone.
    expect(unwrapResult(await repository.readNote('First.md')).content).toBe('Body');
    unwrapResult(await saver.flushContent(identifier));
    expect(saver.get(identifier)?.note.relativePath).toBe('First.md');
    // Anything that saves everything, such as closing the app, commits it first.
    unwrapResult(await saver.flushAll());
    expect(saver.get(identifier)?.note.relativePath).toBe('Typing.md');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('commits typing that is still pending when a single note is flushed', async () => {
    const { saver, identifier } = await setup();
    saver.editTitle(identifier, 'Leaving');
    unwrapResult(await saver.flush(identifier));
    expect(saver.get(identifier)?.note.relativePath).toBe('Leaving.md');
  });

  it('stops the quiet-field timer while paused and restarts it on resume', async () => {
    const { saver, identifier } = await setup();
    saver.editTitle(identifier, 'Paused');
    saver.pause();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(saver.get(identifier)?.note.relativePath).toBe('First.md');
    saver.editTitle(identifier, 'Paused too');
    expect(vi.getTimerCount()).toBe(0);
    saver.resume();
    await vi.advanceTimersByTimeAsync(800);
    expect(saver.get(identifier)?.note.relativePath).toBe('Paused too.md');
  });

  it('keeps the typed title and reports invalid-name, then recovers when the user retypes', async () => {
    const { saver, identifier } = await setup();
    expect((await saver.commitTitle(identifier, 'CON')).ok).toBe(false);
    expect(saver.get(identifier)).toMatchObject({ title: 'CON', error: { code: 'invalid-name' } });
    unwrapResult(await saver.commitTitle(identifier, 'First'));
    expect(saver.get(identifier)).toMatchObject({ title: 'First', error: null, dirty: false });
  });

  it('ignores unknown notes and drops its timer with the note', async () => {
    const { saver, identifier } = await setup();
    saver.editTitle('missing', 'Nothing');
    expect((await saver.commitTitle('missing', 'Nothing')).ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    saver.editTitle(identifier, 'Released');
    saver.release(identifier);
    expect(saver.get(identifier)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops its timer when the note is deleted, and when the note is reloaded', async () => {
    const { saver, identifier } = await setup();
    saver.editTitle(identifier, 'Deleted soon');
    saver.forgetDeletedPath('First.md');
    expect(vi.getTimerCount()).toBe(0);
    const reloaded = unwrapResult(await saver.load('Second.md'));
    saver.editTitle(reloaded.identifier, 'Reloaded');
    unwrapResult(await saver.load('Second.md'));
    expect(vi.getTimerCount()).toBe(0);
  });
});
