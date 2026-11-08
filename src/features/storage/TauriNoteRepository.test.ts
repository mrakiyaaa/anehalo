import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { TauriNoteRepository } from './TauriNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { success } from './repository-result';
import { defaultScanLimits } from './ScanLimits';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }));
beforeEach(() => vi.resetAllMocks());

describe('native vault snapshots', () => {
  it('times out a native scan and does not start content hydration after failure', async () => {
    vi.mocked(invoke).mockImplementationOnce(() => new Promise(() => undefined));
    const repository = new TauriNoteRepository('C:/Notes/Anehalo');
    expect(
      await repository.listTree({ ...defaultScanLimits, maximumDurationMilliseconds: 10 }),
    ).toMatchObject({ ok: false, error: { code: 'scan-limit' } });
    expect(invoke).toHaveBeenCalledOnce();
  });
  it('reads the current file when a save supersedes a background snapshot', async () => {
    vi.mocked(invoke).mockResolvedValue({
      folders: [],
      notes: [{ relativePath: 'Plan.md', content: 'Old content', modifiedAt: 1 }],
    });
    const repository = new TauriNoteRepository('C:/Vault');
    unwrapResult(await repository.hydrateTree());
    const old = unwrapResult(await repository.readSnapshotNote('Plan.md'));
    const saved = {
      ...old,
      content: 'Saved while loading',
      searchText: 'Saved while loading',
      snippet: 'Saved while loading',
      modifiedAt: 2,
    };
    const readNote = vi.spyOn(repository, 'readNote').mockResolvedValue(success(saved));
    expect(unwrapResult(await repository.readSnapshotNote('Plan.md', saved)).content).toBe(
      'Saved while loading',
    );
    expect(readNote).toHaveBeenCalledWith('Plan.md');
  });
  it('sorts summaries, preserves content for indexing, and keeps content out of the tree', async () => {
    vi.mocked(invoke).mockResolvedValue({
      folders: ['Work/Nested', 'Work'],
      notes: [
        { relativePath: 'Work/Older.md', content: '**සිංහල**', modifiedAt: 10 },
        { relativePath: 'New.md', content: 'Newest', modifiedAt: 20 },
      ],
    });
    const repository = new TauriNoteRepository('C:/Vault');
    const tree = unwrapResult(await repository.listTree());
    expect(tree.folders.map((folder) => folder.relativePath)).toEqual(['Work', 'Work/Nested']);
    expect(tree.notes.map((note) => note.title)).toEqual(['New', 'Older']);
    expect(tree.notes[1]).toMatchObject({ folder: 'Work', searchText: 'සිංහල' });
    expect(tree.notes[1]).not.toHaveProperty('content');
    expect(unwrapResult(await repository.readSnapshotNote('Work/Older.md')).content).toBe(
      '**සිංහල**',
    );
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invoke).mock.calls[0]?.[0]).toBe('read_vault_snapshot');
    expect(vi.mocked(invoke).mock.calls[0]?.[1]).toMatchObject({
      vaultPath: 'C:/Vault',
      includeContent: false,
    });
    expect(vi.mocked(invoke).mock.calls[1]?.[0]).toBe('read_vault_snapshot');
    expect(vi.mocked(invoke).mock.calls[1]?.[1]).toMatchObject({
      vaultPath: 'C:/Vault',
      includeContent: true,
    });
  });

  it('returns usable metadata before content hydration completes and then supplies previews', async () => {
    const snapshot = {
      folders: [],
      notes: [{ relativePath: 'Plan.md', content: 'A full preview', modifiedAt: 1 }],
    };
    let completeHydration: (value: typeof snapshot) => void = () => {
      throw new Error('Hydration was not initialized.');
    };
    const hydration = new Promise<typeof snapshot>((resolve) => {
      completeHydration = resolve;
    });
    vi.mocked(invoke)
      .mockResolvedValueOnce({ ...snapshot, notes: [{ ...snapshot.notes[0], content: '' }] })
      .mockReturnValueOnce(hydration);
    const repository = new TauriNoteRepository('C:/Vault');
    expect(unwrapResult(await repository.listTree()).notes[0]?.snippet).toBe('');
    const indexed = repository.readSnapshotNote('Plan.md');
    completeHydration(snapshot);
    expect(unwrapResult(await repository.hydrateTree()).notes[0]?.snippet).toBe('A full preview');
    expect(unwrapResult(await indexed).content).toBe('A full preview');
    vi.mocked(invoke)
      .mockResolvedValueOnce({ ...snapshot, notes: [{ ...snapshot.notes[0], content: '' }] })
      .mockResolvedValueOnce(snapshot);
    expect(unwrapResult(await repository.listTree()).notes[0]?.snippet).toBe('A full preview');
    unwrapResult(await repository.hydrateTree());
  });

  it('reports hydration failures through both indexing and preview results', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ folders: [], notes: [] })
      .mockRejectedValueOnce(new Error('Access denied'));
    const repository = new TauriNoteRepository('C:/Vault');
    unwrapResult(await repository.listTree());
    expect(await repository.hydrateTree()).toMatchObject({
      ok: false,
      error: { code: 'permission-denied' },
    });
    expect(await repository.readSnapshotNote('Private.md')).toMatchObject({
      ok: false,
      error: { code: 'permission-denied' },
    });
  });

  it('returns typed filesystem failures and rejects paths that escape the vault', async () => {
    const repository = new TauriNoteRepository('C:/Vault');
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Access denied'));
    expect(await repository.listTree()).toMatchObject({
      ok: false,
      error: { code: 'permission-denied' },
    });
    vi.mocked(invoke).mockResolvedValueOnce({
      folders: [],
      notes: [{ relativePath: '../Private.md', content: 'Secret', modifiedAt: 1 }],
    });
    expect(await repository.listTree()).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    });
    vi.mocked(invoke).mockResolvedValueOnce({ folders: ['../Private'], notes: [] });
    expect((await repository.listTree()).ok).toBe(false);
  });
});
