import { describe, expect, it } from 'vitest';
import { unwrapResult } from '@/test/repository-helpers';
import {
  emptyDiagramFile as emptyText,
  memoryVault as vault,
  sceneWith,
} from '@/test/diagram-helpers';

describe('DiagramRepository', () => {
  it('creates "Untitled diagram" files with the same numbering notes use', async () => {
    const { diagrams } = vault([{ relativePath: 'Plans', type: 'directory' }]);

    const first = unwrapResult(await diagrams.createDiagram('Plans'));
    const second = unwrapResult(await diagrams.createDiagram('Plans'));
    const named = unwrapResult(await diagrams.createDiagram(null, 'Flow: v2?'));

    expect(first).toMatchObject({
      kind: 'diagram',
      relativePath: 'Plans/Untitled diagram.excalidraw',
    });
    expect(second.relativePath).toBe('Plans/Untitled diagram 2.excalidraw');
    expect(named).toMatchObject({ relativePath: 'Flow v2.excalidraw', title: 'Flow v2' });
  });

  it('writes atomically and reads back the drawing with the exact file text', async () => {
    const { diagrams, files } = vault();
    const created = unwrapResult(await diagrams.createDiagram());

    const saved = unwrapResult(await diagrams.writeDiagram(created.relativePath, sceneWith('box')));
    const loaded = unwrapResult(await diagrams.readDiagram(created.relativePath));

    expect(loaded.scene.elements.map((element) => element.id)).toEqual(['box']);
    expect(loaded.text).toBe(saved.text);
    expect(files.operations.some(({ path }) => path.endsWith('.tmp'))).toBe(true);
  });

  it('refuses to open an unreadable file and leaves its bytes alone', async () => {
    const { diagrams, files } = vault([
      { relativePath: 'Broken.excalidraw', type: 'file', content: '{"type":"excal' },
    ]);

    const result = await diagrams.readDiagram('Broken.excalidraw');

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-diagram' } });
    expect(await files.readText('Broken.excalidraw')).toBe('{"type":"excal');
  });

  it('renames with numbering, moves between folders, and trashes into .trash', async () => {
    const { diagrams, files } = vault([
      { relativePath: 'Plans', type: 'directory' },
      { relativePath: 'Archive', type: 'directory' },
      { relativePath: 'Archive/Flow.excalidraw', type: 'file', content: emptyText },
      { relativePath: 'Plans/Flow.excalidraw', type: 'file', content: emptyText },
      { relativePath: 'Plans/Draft.excalidraw', type: 'file', content: emptyText },
    ]);

    const renamed = unwrapResult(await diagrams.renameDiagram('Plans/Draft.excalidraw', 'Flow'));
    const moved = unwrapResult(await diagrams.moveDiagram(renamed.relativePath, 'Archive'));
    const trashed = unwrapResult(await diagrams.trashDiagram(moved.relativePath));

    expect(renamed.relativePath).toBe('Plans/Flow 2.excalidraw');
    expect(moved.relativePath).toBe('Archive/Flow 2.excalidraw');
    expect(trashed.trashPath).toMatch(/^\.trash\/.+\/Archive\/Flow 2\.excalidraw$/);
    expect(await files.metadata('Archive/Flow 2.excalidraw')).toBeNull();
    expect(await files.readText(trashed.trashPath)).toBe(emptyText);
  });

  it('only handles .excalidraw files', async () => {
    const { diagrams } = vault([{ relativePath: 'Idea.md', type: 'file', content: '# Idea' }]);

    expect(await diagrams.trashDiagram('Idea.md')).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    });
  });

  it('shares one queue with notes, so a note and a diagram never take the same name', async () => {
    const { notes, diagrams } = vault();

    const [note, diagram] = await Promise.all([
      notes.createNote({ title: 'Plan' }),
      diagrams.createDiagram(null, 'Plan'),
    ]);

    expect(unwrapResult(note).relativePath).toBe('Plan.md');
    expect(unwrapResult(diagram).relativePath).toBe('Plan.excalidraw');
    expect(unwrapResult(await notes.listTree()).diagrams.map((item) => item.title)).toEqual([
      'Plan',
    ]);
  });
});
