import { describe, expect, it } from 'vitest';
import { FileSystemNoteRepository } from '@/features/storage/FileSystemNoteRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { MAXIMUM_NAME_LENGTH, sanitizeName } from '@/features/storage/note-names';
import { createSnippet, markdownToPlainText } from '@/features/storage/note-snippet';
import { assertInsideVault } from '@/features/storage/storage-paths';
import { unwrapResult } from '@/test/repository-helpers';

describe('vault initialization', () => {
  it('creates one welcome note on an empty first launch', async () => {
    const repository = new InMemoryNoteRepository();
    const tree = unwrapResult(await repository.listTree());
    expect(tree.folders.map((folder) => folder.relativePath)).toEqual(['Getting started']);
    expect(tree.notes.map((note) => note.relativePath)).toEqual(['Getting started/Welcome.md']);
    expect(unwrapResult(await repository.readNote('Getting started/Welcome.md')).content).toContain(
      '# Welcome',
    );
    expect(unwrapResult(await repository.listTree()).notes).toHaveLength(1);
  });

  it('keeps existing vaults and root notes intact', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Existing.md', type: 'file', content: 'Existing text' },
    ]);
    expect(
      unwrapResult(await repository.listTree()).notes.map((note) => note.relativePath),
    ).toEqual(['Existing.md']);
    expect(unwrapResult(await repository.readNote('Existing.md')).folder).toBeNull();
  });

  it('does not recreate starter content after the user deletes it and restarts', async () => {
    const repository = new InMemoryNoteRepository();
    unwrapResult(await repository.listTree());
    unwrapResult(await repository.deleteFolder('Getting started'));
    const restarted = new FileSystemNoteRepository(repository.memoryFileSystem);
    expect(unwrapResult(await restarted.listTree()).notes).toEqual([]);
  });
});

describe('Windows names and duplicate suffixes', () => {
  it('removes invalid characters, controls, and leading or trailing dots and spaces', () => {
    expect(sanitizeName(' ..  bad\\/:*?"<>|name.  ', 'Untitled')).toBe('badname');
    expect(sanitizeName(`a${String.fromCharCode(0)}b`, 'Untitled')).toBe('ab');
    expect(sanitizeName(' . ', 'Untitled note')).toBe('Untitled note');
    expect([...sanitizeName('🌼'.repeat(200), 'Untitled')]).toHaveLength(MAXIMUM_NAME_LENGTH);
  });

  it.each([
    'CON',
    'con.txt',
    'PRN',
    'AUX',
    'NUL',
    ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
  ])('rejects reserved name %s through a typed result', async (name) => {
    const result = await new InMemoryNoteRepository().createNote({ title: name });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-name');
  });

  it('suffixes duplicate notes and folders without overwriting', async () => {
    const repository = new InMemoryNoteRepository();
    const first = unwrapResult(await repository.createNote({ content: 'First' }));
    const second = unwrapResult(
      await repository.createNote({ title: 'untitled NOTE', content: 'Second' }),
    );
    expect(first.relativePath).toBe('Untitled note.md');
    expect(second.relativePath).toBe('untitled NOTE 2.md');
    expect(unwrapResult(await repository.readNote(first.relativePath)).content).toBe('First');
    expect(unwrapResult(await repository.createFolder('Work')).name).toBe('Work');
    expect(unwrapResult(await repository.createFolder('Work')).name).toBe('Work 2');
  });

  it('serializes concurrent creations so every path is unique', async () => {
    const repository = new InMemoryNoteRepository();
    const notes = await Promise.all(Array.from({ length: 12 }, () => repository.createNote()));
    expect(new Set(notes.map((result) => unwrapResult(result).relativePath)).size).toBe(12);
    expect(
      unwrapResult(
        notes[11] ?? { ok: false, error: { code: 'io-error', message: 'Missing result' } },
      ).title,
    ).toBe('Untitled note 12');
  });
});

describe('path boundaries', () => {
  it.each([
    '../outside.md',
    '/outside.md',
    'C:/outside.md',
    'C:\\outside.md',
    'work/../../outside.md',
    'work/../outside.md',
    'work//note.md',
    'work/./note.md',
    'work/.. /note.md',
    '.trash/hidden.md',
    'CON.md',
    'note.md:stream',
  ])('rejects unsafe path %s', async (path) => {
    const repository = new InMemoryNoteRepository();
    const result = await repository.readNote(path);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-path');
  });

  it('checks containment with a directory boundary, not only a shared prefix', () => {
    expect(() =>
      assertInsideVault('C:\\Documents\\Anehalo', 'C:\\Documents\\Anehalo-other\\note.md'),
    ).toThrow();
    expect(() =>
      assertInsideVault('C:\\Documents\\Anehalo', 'C:\\Documents\\Anehalo\\Work\\note.md'),
    ).not.toThrow();
  });

  it('does not list or follow hidden directories and symbolic links', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: '.private/Secret.md', type: 'file', content: 'Hidden' },
      { relativePath: 'Escape', type: 'link' },
      { relativePath: 'Visible.MD', type: 'file', content: 'Shown' },
    ]);
    const tree = unwrapResult(await repository.listTree());
    expect(tree.folders).toEqual([]);
    expect(tree.notes.map((note) => note.title)).toEqual(['Visible']);
    const result = await repository.createNote({ folder: 'Escape' });
    expect(result.ok).toBe(false);
  });
});

describe('note and folder changes', () => {
  it('creates, writes, reads and renames a note using its relative identity', async () => {
    const repository = new InMemoryNoteRepository();
    unwrapResult(await repository.createFolder('Work'));
    const note = unwrapResult(
      await repository.createNote({ folder: 'Work', title: 'Plan.md', content: 'First draft' }),
    );
    expect(note.relativePath).toBe('Work/Plan.md');
    unwrapResult(await repository.writeNote(note.relativePath, '# Plan\n\n**Updated** draft'));
    const renamed = unwrapResult(await repository.renameNote(note.relativePath, 'Next: plan'));
    expect(renamed.relativePath).toBe('Work/Next plan.md');
    expect(renamed.content).toBe('# Plan\n\n**Updated** draft');
    expect(renamed.snippet).toBe('Plan Updated draft');
    expect((await repository.readNote(note.relativePath)).ok).toBe(false);
  });

  it('renames folders with nested notes and rejects colliding renames', async () => {
    const repository = new InMemoryNoteRepository();
    unwrapResult(await repository.createFolder('Work'));
    unwrapResult(await repository.createFolder('Nested', 'Work'));
    unwrapResult(await repository.createNote({ folder: 'Work/Nested', title: 'Meeting' }));
    unwrapResult(await repository.renameFolder('Work', 'Projects'));
    expect(unwrapResult(await repository.readNote('Projects/Nested/Meeting.md')).title).toBe(
      'Meeting',
    );
    const second = unwrapResult(
      await repository.createNote({ folder: 'Projects/Nested', title: 'Other' }),
    );
    const collision = await repository.renameNote(second.relativePath, 'Meeting');
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.code).toBe('already-exists');
    unwrapResult(await repository.createFolder('Other'));
    expect((await repository.renameFolder('Other', 'Projects')).ok).toBe(false);
  });

  it('returns an error for writes to missing files instead of recreating deleted notes', async () => {
    const result = await new InMemoryNoteRepository().writeNote('Missing.md', 'Do not recreate');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-found');
  });

  it('lists the most recently modified note first', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Old.md', type: 'file', modifiedAt: 1000 },
      { relativePath: 'New.md', type: 'file', modifiedAt: 3000 },
      { relativePath: 'Middle.md', type: 'file', modifiedAt: 2000 },
    ]);
    expect(unwrapResult(await repository.listTree()).notes.map((note) => note.title)).toEqual([
      'New',
      'Middle',
      'Old',
    ]);
  });
});

describe('atomic writes and recoverable trash', () => {
  it('writes a temporary sibling then renames it, leaving no temporary files', async () => {
    const repository = new InMemoryNoteRepository();
    const note = unwrapResult(await repository.createNote({ content: 'Original' }));
    repository.memoryFileSystem.operations.length = 0;
    unwrapResult(await repository.writeNote(note.relativePath, 'Complete replacement'));
    expect(repository.memoryFileSystem.operations[0]?.path).toMatch(/^\.anehalo-.*\.tmp$/);
    expect(repository.memoryFileSystem.operations[1]).toMatchObject({
      operation: 'rename',
      destination: note.relativePath,
    });
    expect(
      repository.memoryFileSystem.snapshot().some((entry) => entry.relativePath.endsWith('.tmp')),
    ).toBe(false);
  });

  it.each(['write', 'rename'] as const)(
    'preserves original content when %s fails',
    async (operation) => {
      const repository = new InMemoryNoteRepository();
      const note = unwrapResult(await repository.createNote({ content: 'Keep this' }));
      repository.memoryFileSystem.failNext(operation);
      const result = await repository.writeNote(note.relativePath, 'Failed replacement');
      expect(result.ok).toBe(false);
      expect(unwrapResult(await repository.readNote(note.relativePath)).content).toBe('Keep this');
      expect(
        repository.memoryFileSystem.snapshot().some((entry) => entry.relativePath.endsWith('.tmp')),
      ).toBe(false);
    },
  );

  it('moves notes and whole folders to unique trash entries with original paths and contents', async () => {
    const repository = new InMemoryNoteRepository();
    unwrapResult(await repository.createFolder('Work'));
    const note = unwrapResult(
      await repository.createNote({ folder: 'Work', title: 'Plan', content: 'Recover me' }),
    );
    const deleted = unwrapResult(await repository.deleteNote(note.relativePath));
    expect(deleted.trashPath).toMatch(/^\.trash\/.*\/Work\/Plan\.md$/);
    expect(
      repository.memoryFileSystem
        .snapshot()
        .find((entry) => entry.relativePath === deleted.trashPath)?.content,
    ).toBe('Recover me');
    unwrapResult(await repository.createFolder('Nested', 'Work'));
    unwrapResult(await repository.createNote({ folder: 'Work/Nested', content: 'Nested content' }));
    const deletedFolder = unwrapResult(await repository.deleteFolder('Work'));
    expect(
      repository.memoryFileSystem
        .snapshot()
        .find(
          (entry) => entry.relativePath === `${deletedFolder.trashPath}/Nested/Untitled note.md`,
        )?.content,
    ).toBe('Nested content');
    const tree = unwrapResult(await repository.listTree());
    expect(tree.folders.some((folder) => folder.relativePath.startsWith('.'))).toBe(false);
    expect(tree.notes.some((entry) => entry.folder === 'Work')).toBe(false);
    expect((await repository.deleteFolder('')).ok).toBe(false);
  });
});

describe('plain-text snippets', () => {
  it('removes frontmatter, headings, emphasis, links, code fences, and HTML', () => {
    const content =
      '---\nprivate: metadata\n---\n# Title\n**Strong** and [a link](https://example.com)\n```ts\ncode()\n```\n<b>text</b> &amp; &#65;';
    expect(markdownToPlainText(content)).toBe('Title Strong and a link code() text & A');
  });

  it('limits snippets to 120 Unicode characters without splitting emoji', () => {
    const snippet = createSnippet('🌼'.repeat(150));
    expect([...snippet]).toHaveLength(120);
    expect(snippet.endsWith('…')).toBe(true);
    expect(createSnippet('Short note')).toBe('Short note');
  });
});
