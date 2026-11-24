import { beforeEach, describe, expect, it, vi } from 'vitest';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));
import { DiagramParseError } from '@/features/diagrams/diagram-errors';
import { failure, success } from '@/features/storage/repository-result';
import type { DiagramSummary } from '@/types/notes';
import { noSceneError, noSceneMessage } from './diagram-import-errors';
import { DiagramImportService, type ImportCandidate } from './DiagramImportService';
import { LARGE_IMPORT_BYTES, type ImportFileKind } from './import-file-kind';

beforeEach(() => logFailure.mockClear());

const bytes = new TextEncoder().encode('{}');

function candidate(name: string, size = bytes.length): ImportCandidate & { read: () => number } {
  let reads = 0;
  return {
    name,
    size,
    bytes: () => {
      reads += 1;
      return Promise.resolve(bytes);
    },
    read: () => reads,
  };
}

function setup(
  options: { decode?: (kind: ImportFileKind) => Promise<string>; confirm?: boolean } = {},
) {
  const written: { folder: string | null; title: string; text: string }[] = [];
  const confirmed: string[] = [];
  const service = new DiagramImportService({
    decode: options.decode ?? ((kind) => Promise.resolve(`decoded ${kind}`)),
    write: (folder, title, text) => {
      written.push({ folder, title, text });
      const summary: DiagramSummary = {
        kind: 'diagram',
        title,
        folder,
        relativePath: `${folder ? `${folder}/` : ''}${title}.excalidraw`,
        modifiedAt: 1,
      };
      return Promise.resolve(success(summary));
    },
    confirmLarge: (file) => {
      confirmed.push(file.name);
      return Promise.resolve(options.confirm ?? true);
    },
  });
  return { service, written, confirmed };
}

describe('importing diagrams', () => {
  it('copies each supported file under its own title into the folder', async () => {
    const { service, written } = setup();
    const report = await service.importFiles(
      [candidate('Flow.excalidraw'), candidate('Map.excalidraw.png'), candidate('Logo.svg')],
      'Work',
    );
    expect(report.skipped).toEqual([]);
    expect(report.imported.map((diagram) => diagram.relativePath)).toEqual([
      'Work/Flow.excalidraw',
      'Work/Map.excalidraw',
      'Work/Logo.excalidraw',
    ]);
    expect(written.map(({ text }) => text)).toEqual([
      'decoded excalidraw',
      'decoded png',
      'decoded svg',
    ]);
  });

  it('skips a type it cannot import, without reading the file', async () => {
    const { service, written } = setup();
    const notes = candidate('notes.md');
    const report = await service.importFiles([notes], null);
    expect(report.skipped).toEqual([
      {
        name: 'notes.md',
        message:
          'Only .excalidraw files and PNG or SVG images exported with “Embed scene” can be imported.',
      },
    ]);
    expect(notes.read()).toBe(0);
    expect(written).toEqual([]);
  });

  it('tells an image without a drawing apart, and writes nothing for it', async () => {
    const { service, written } = setup({ decode: () => Promise.reject(noSceneError()) });
    const report = await service.importFiles([candidate('photo.png')], null);
    expect(report.skipped).toEqual([{ name: 'photo.png', message: noSceneMessage }]);
    expect(written).toEqual([]);
  });

  it('turns a corrupt drawing into a friendly message and writes nothing', async () => {
    const { service, written } = setup({
      decode: () => Promise.reject(new DiagramParseError('Invalid JSON: Unexpected end')),
    });
    const report = await service.importFiles([candidate('broken.excalidraw')], null);
    expect(report.skipped[0]?.message).toBe('This file is not a valid Excalidraw drawing.');
    expect(JSON.stringify(report)).not.toMatch(/Unexpected end/);
    expect(written).toEqual([]);
    expect(logFailure).toHaveBeenCalledWith('diagram-import-failed', 'invalid-diagram');
  });

  it('reports a file that cannot be read', async () => {
    const { service, written } = setup();
    const report = await service.importFiles(
      [
        {
          name: 'gone.excalidraw',
          size: 10,
          bytes: () => Promise.reject(new Error('The file is locked')),
        },
      ],
      null,
    );
    expect(report.skipped[0]?.message).toBe(
      'This file could not be read. Check that it still exists.',
    );
    expect(written).toEqual([]);
  });

  it('reports a write that fails and goes on with the rest', async () => {
    const service = new DiagramImportService({
      decode: () => Promise.resolve('text'),
      write: (_folder, title) =>
        Promise.resolve(
          title === 'Full'
            ? failure({
                code: 'disk-full',
                message: 'Could not import the diagram. The disk is full.',
              })
            : success({
                kind: 'diagram' as const,
                title,
                folder: null,
                relativePath: `${title}.excalidraw`,
                modifiedAt: 1,
              }),
        ),
      confirmLarge: () => Promise.resolve(true),
    });
    const report = await service.importFiles(
      [candidate('Full.excalidraw'), candidate('Fine.excalidraw')],
      null,
    );
    expect(report.imported.map((diagram) => diagram.title)).toEqual(['Fine']);
    expect(report.skipped).toEqual([
      { name: 'Full.excalidraw', message: 'Could not import the diagram. The disk is full.' },
    ]);
  });
});

describe('large files', () => {
  it('does not ask for a file at 50 MB, but does for one over it', async () => {
    const { service, confirmed } = setup();
    await service.importFiles(
      [
        candidate('exactly.excalidraw', LARGE_IMPORT_BYTES),
        candidate('over.excalidraw', LARGE_IMPORT_BYTES + 1),
      ],
      null,
    );
    expect(confirmed).toEqual(['over.excalidraw']);
  });

  it('skips a large file when declined, without reading it', async () => {
    const { service, written } = setup({ confirm: false });
    const large = candidate('huge.excalidraw', LARGE_IMPORT_BYTES + 1);
    const report = await service.importFiles([large, candidate('small.excalidraw')], null);
    expect(large.read()).toBe(0);
    expect(report.imported.map((diagram) => diagram.title)).toEqual(['small']);
    expect(report.skipped[0]?.message).toMatch(/you chose not to import/);
    expect(written).toHaveLength(1);
  });

  it('imports a large file when confirmed', async () => {
    const { service } = setup({ confirm: true });
    const report = await service.importFiles(
      [candidate('huge.excalidraw', LARGE_IMPORT_BYTES + 1)],
      null,
    );
    expect(report.imported).toHaveLength(1);
  });
});
