import { describe, expect, it, vi } from 'vitest';
import { NoteLinkIndex } from './NoteLinkIndex';
import { LinkedNoteRepository } from './LinkedNoteRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { failure } from '@/features/storage/repository-result';

async function setup() {
  const source = new InMemoryNoteRepository([
    { relativePath: 'A.md', type: 'file', content: '[B](Work/B.md) [B](Work/B.md)' },
    { relativePath: 'Work/B.md', type: 'file', content: '[A](A.md)' },
    { relativePath: 'Other.md', type: 'file', content: 'Unchanged\r\n' },
  ]);
  const index = new NoteLinkIndex();
  const report = vi.fn();
  const repository = new LinkedNoteRepository(source, index, vi.fn(), report);
  unwrapResult(await index.rebuild(source, unwrapResult(await source.listTree()).notes));
  return { source, index, repository, report };
}
describe('link index and repository adapter', () => {
  it('debounces focus scans and reads the current tree when the scan starts', async () => {
    const { source, repository, index } = await setup();
    const report = vi.fn();
    const list = vi.spyOn(source, 'listTree');
    vi.useFakeTimers();
    try {
      index.scheduleRebuild(source, report);
      index.scheduleRebuild(source, report);
      unwrapResult(await repository.renameFolder('Work', 'Moved'));
      list.mockClear();
      await vi.advanceTimersByTimeAsync(180);
      expect(list).toHaveBeenCalledOnce();
      expect(index.snapshot().outgoing.has('Moved/B.md')).toBe(true);
      expect(index.snapshot().outgoing.has('Work/B.md')).toBe(false);
      expect(index.snapshot().backlinks.get('Moved/B.md')).toEqual(['A.md']);
      expect(report).not.toHaveBeenCalled();
    } finally {
      index.cancel();
      vi.useRealTimers();
    }
  });
  it('builds deduplicated backlinks and updates them after saves, renames and deletes', async () => {
    const { index, repository } = await setup();
    expect(index.snapshot().backlinks.get('Work/B.md')).toEqual(['A.md']);
    unwrapResult(await repository.writeNote('Other.md', '[B](Work/B.md)'));
    expect(index.snapshot().backlinks.get('Work/B.md')).toEqual(['A.md', 'Other.md']);
    unwrapResult(await repository.renameNote('Work/B.md', 'New B'));
    expect(index.snapshot().backlinks.has('Work/B.md')).toBe(false);
    expect(index.snapshot().backlinks.get('Work/New B.md')).toEqual(['A.md', 'Other.md']);
    unwrapResult(await repository.deleteNote('Work/New B.md'));
    expect(index.snapshot().outgoing.has('Work/New B.md')).toBe(false);
    expect(index.snapshot().backlinks.get('Work/New B.md')).toEqual(['A.md', 'Other.md']);
    expect(unwrapResult(await repository.readNote('A.md')).content).toContain(
      '[New B](Work/New%20B.md)',
    );
  });
  it('rewrites folder links and only atomically writes changed files', async () => {
    const { source, repository, index } = await setup();
    const write = vi.spyOn(source, 'writeNote');
    unwrapResult(await repository.renameFolder('Work', 'Projects'));
    expect(write).toHaveBeenCalledExactlyOnceWith('A.md', '[B](Projects/B.md) [B](Projects/B.md)');
    expect(index.snapshot().backlinks.get('A.md')).toEqual(['Projects/B.md']);
    expect(unwrapResult(await source.readNote('Other.md')).content).toBe('Unchanged\r\n');
  });
  it('continues after a failed file and reports a summary', async () => {
    const { source, repository, report } = await setup();
    unwrapResult(await source.writeNote('Other.md', '[B](Work/B.md)'));
    const write = source.writeNote.bind(source);
    vi.spyOn(source, 'writeNote').mockImplementation((path, content) =>
      path === 'A.md'
        ? Promise.resolve(failure({ code: 'permission-denied', message: 'Locked' }))
        : write(path, content),
    );
    expect((await repository.renameNote('Work/B.md', 'Next')).ok).toBe(true);
    expect(unwrapResult(await source.readNote('Other.md')).content).toBe('[Next](Work/Next.md)');
    expect(unwrapResult(await source.readNote('A.md')).content).toContain('Work/B.md');
    expect(report.mock.calls[0]?.[0] as unknown).toMatchObject({
      message: 'The rename succeeded, but links could not be updated in 1 note(s).',
    });
  });
  it('rebuilds after external changes and removes deleted sources', async () => {
    const { source, index } = await setup();
    unwrapResult(await source.writeNote('A.md', '[Other](Other.md)'));
    unwrapResult(await source.deleteNote('Work/B.md'));
    unwrapResult(await index.rebuild(source, unwrapResult(await source.listTree()).notes));
    expect(index.snapshot().backlinks.has('Work/B.md')).toBe(false);
    expect(index.snapshot().backlinks.get('Other.md')).toEqual(['A.md']);
  });
  it('does not let a concurrent scan overwrite a newer save', async () => {
    const { source, index } = await setup();
    const tree = unwrapResult(await source.listTree());
    const read = source.readNote.bind(source);
    let proceed = () => {};
    let reached = () => {};
    const started = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      proceed = resolve;
    });
    vi.spyOn(source, 'readNote').mockImplementationOnce(async (path) => {
      const original = await read(path);
      reached();
      await pending;
      return original;
    });
    const scan = index.rebuild(source, tree.notes);
    await started;
    const first = tree.notes[0]!;
    const changed = unwrapResult(await source.writeNote(first.relativePath, '[Fresh](Fresh.md)'));
    index.update(changed);
    proceed();
    await scan;
    expect(index.snapshot().outgoing.get(first.relativePath)).toEqual(new Set(['Fresh.md']));
  });
});
