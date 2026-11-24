import { describe, expect, it } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import { fakeDiagramCodec, diagramFile } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { LinkedNoteRepository } from './LinkedNoteRepository';
import { NoteLinkIndex } from './NoteLinkIndex';
import { DiagramContentScan } from '@/features/diagrams/DiagramContentScan';
import { mayReferTo, rewriteNoteLinks, scanVaultLinks } from './NoteLinkRewriter';
import { decodeItemPath, decodeNotePath } from './note-link-paths';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';

function linkedDiagram(link: string) {
  return JSON.stringify({ type: 'excalidraw', elements: [{ id: 'a', type: 'rectangle', link }] });
}

function vault(seed: readonly MemoryEntry[]) {
  const notes = new InMemoryNoteRepository(seed);
  const diagrams = new DiagramRepository(notes.storage, () => Promise.resolve(fakeDiagramCodec));
  const index = new NoteLinkIndex();
  const scan = new DiagramContentScan(diagrams, [index]);
  const linked = new LinkedNoteRepository(
    notes,
    index,
    () => undefined,
    (error) => {
      throw new Error(error.message);
    },
    diagrams,
  );
  /** Notes through the link index's rebuild, diagrams through the shared scan, as in the app. */
  async function indexAll() {
    unwrapResult(await index.rebuild(notes));
    unwrapResult(await scan.scan(unwrapResult(await notes.listTree()).diagrams));
  }
  return { notes, diagrams, index, linked, indexAll, files: notes.memoryFileSystem };
}

describe('paths to notes and diagrams', () => {
  it('decodes diagram paths for items but keeps note-only decoding unchanged', () => {
    expect(decodeItemPath('Work/My%20Flow.excalidraw')).toEqual({
      ok: true,
      value: 'Work/My Flow.excalidraw',
    });
    expect(decodeNotePath('Work/My%20Flow.excalidraw').ok).toBe(false);
    expect(decodeItemPath('../Flow.excalidraw').ok).toBe(false);
    expect(decodeItemPath('https://example.com/Flow.excalidraw').ok).toBe(false);
  });

  it('scans diagram links and embeds, but not other images', () => {
    const links = scanVaultLinks(
      '[Plan](Plan.md) [Flow](Flow.excalidraw)\n\n![Flow](Flow.excalidraw)\n\n![Photo](.attachments/a.png)',
    );
    expect(links.map(({ path, embed }) => ({ path, embed }))).toEqual([
      { path: 'Plan.md', embed: false },
      { path: 'Flow.excalidraw', embed: false },
      { path: 'Flow.excalidraw', embed: true },
    ]);
  });

  it('rewrites diagram links and embeds on rename, keeping embeds as embeds', () => {
    const rewritten = rewriteNoteLinks(
      'See [Flow](Plans/Flow.excalidraw).\n\n![Flow](Plans/Flow.excalidraw)\n\n[Plan](Plan.md)',
      { previousPath: 'Plans/Flow.excalidraw', nextPath: 'Archive/Release flow.excalidraw' },
    );
    expect(rewritten).toBe(
      'See [Release flow](Archive/Release%20flow.excalidraw).\n\n![Release flow](Archive/Release%20flow.excalidraw)\n\n[Plan](Plan.md)',
    );
  });

  it('writes note links exactly as before', () => {
    expect(
      rewriteNoteLinks('[Old](Old.md) and [custom](Old.md)', {
        previousPath: 'Old.md',
        nextPath: 'New name.md',
      }),
    ).toBe('[New name](New%20name.md) and [custom](New%20name.md)');
  });

  it.each([
    ['a space', 'Plans/My Flow.excalidraw'],
    ['a Sinhala name', 'සටහන්/සිංහල රූපය.excalidraw'],
    ['a Tamil name', 'தமிழ்/வரைபடம் ஒன்று.excalidraw'],
  ])('pre-checks a path with %s in its encoded and plain forms', (_case, path) => {
    const rename = { previousPath: path, nextPath: 'Renamed.excalidraw' };
    const encoded = path
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    expect(mayReferTo(`{"link": "${encoded}"}`, rename)).toBe(true);
    expect(mayReferTo(`{"link": "${path}"}`, rename)).toBe(true);
    expect(mayReferTo(`{"link": "${encoded.toLowerCase()}"}`, rename)).toBe(true);
    expect(mayReferTo('{"link": "Elsewhere.md"}', rename)).toBe(false);
  });
});

describe('links across notes and diagrams', () => {
  it('indexes diagrams as sources, so notes get backlinks from diagrams', async () => {
    const { index, indexAll } = vault([
      { relativePath: 'Plan.md', type: 'file', content: '![Flow](Flow.excalidraw)' },
      { relativePath: 'Flow.excalidraw', type: 'file', content: linkedDiagram('Plan.md') },
    ]);
    await indexAll();
    const snapshot = index.snapshot();
    expect(snapshot.backlinks.get('Plan.md')).toEqual(['Flow.excalidraw']);
    expect(snapshot.backlinks.get('Flow.excalidraw')).toEqual(['Plan.md']);
  });

  it('renaming a note updates links inside diagrams and re-indexes them', async () => {
    const { linked, index, files, indexAll } = vault([
      { relativePath: 'Plan.md', type: 'file', content: 'A plan' },
      { relativePath: 'Flow.excalidraw', type: 'file', content: linkedDiagram('Plan.md') },
      { relativePath: 'Other.excalidraw', type: 'file', content: diagramFile('x') },
    ]);
    await indexAll();
    const otherBefore = await files.readText('Other.excalidraw');
    unwrapResult(await linked.renameNote('Plan.md', 'Final plan'));
    expect(await files.readText('Flow.excalidraw')).toContain('"link": "Final plan.md"');
    expect(await files.readText('Other.excalidraw')).toBe(otherBefore);
    expect(index.snapshot().backlinks.get('Final plan.md')).toEqual(['Flow.excalidraw']);
  });

  it('renaming a diagram updates note links and embeds, and its own index entry', async () => {
    const { linked, index, notes, diagrams, indexAll } = vault([
      {
        relativePath: 'Plan.md',
        type: 'file',
        content: '[Flow](Flow.excalidraw)\n\n![Flow](Flow.excalidraw)',
      },
      { relativePath: 'Flow.excalidraw', type: 'file', content: linkedDiagram('Plan.md') },
    ]);
    await indexAll();
    const renamed = unwrapResult(await diagrams.renameDiagram('Flow.excalidraw', 'Pipeline'));
    await linked.rewriteLinks({ previousPath: 'Flow.excalidraw', nextPath: renamed.relativePath });
    expect(unwrapResult(await notes.readNote('Plan.md')).content).toBe(
      '[Pipeline](Pipeline.excalidraw)\n\n![Pipeline](Pipeline.excalidraw)',
    );
    expect(index.snapshot().backlinks.get('Plan.md')).toEqual(['Pipeline.excalidraw']);
  });

  it('finds a trashed diagram and restores it, even when its folder was trashed', async () => {
    const { diagrams, files } = vault([
      { relativePath: 'Work', type: 'directory' },
      { relativePath: 'Work/Flow.excalidraw', type: 'file', content: diagramFile('a') },
    ]);
    expect(unwrapResult(await diagrams.isInTrash('Work/Flow.excalidraw'))).toBe(false);
    unwrapResult(await diagrams.trashDiagram('Work/Flow.excalidraw'));
    expect(unwrapResult(await diagrams.isInTrash('Work/Flow.excalidraw'))).toBe(true);
    unwrapResult(await diagrams.restoreDiagram('Work/Flow.excalidraw'));
    expect(await files.readText('Work/Flow.excalidraw')).toBe(diagramFile('a'));
    expect(unwrapResult(await diagrams.isInTrash('Work/Flow.excalidraw'))).toBe(false);
  });

  it('refuses to restore over a file that now has the same name', async () => {
    const { diagrams, files } = vault([
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('old') },
    ]);
    unwrapResult(await diagrams.trashDiagram('Flow.excalidraw'));
    await files.writeText('Flow.excalidraw', diagramFile('new'));
    expect(await diagrams.restoreDiagram('Flow.excalidraw')).toMatchObject({
      ok: false,
      error: { code: 'already-exists' },
    });
  });
});
