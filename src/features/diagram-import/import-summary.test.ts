import { describe, expect, it } from 'vitest';
import type { DiagramSummary } from '@/types/notes';
import type { ImportReport } from './DiagramImportService';
import { summarizeImport } from './import-summary';

const diagram = (title: string): DiagramSummary => ({
  kind: 'diagram',
  title,
  folder: null,
  relativePath: `${title}.excalidraw`,
  modifiedAt: 1,
});

const report = (imported: string[], skipped: [string, string][] = []): ImportReport => ({
  imported: imported.map(diagram),
  skipped: skipped.map(([name, message]) => ({ name, message })),
});

describe('import summary toast', () => {
  it('names a single imported diagram', () => {
    expect(summarizeImport(report(['Flow']))).toEqual({
      message: 'Imported “Flow”',
      error: false,
    });
  });

  it('counts several imports', () => {
    expect(summarizeImport(report(['A', 'B', 'C']))).toEqual({
      message: '3 imported',
      error: false,
    });
  });

  it('gives a single failed file its own message, as an error', () => {
    expect(
      summarizeImport(report([], [['photo.png', 'This image has no diagram data to import.']])),
    ).toEqual({ message: 'This image has no diagram data to import.', error: true });
  });

  it('counts both imports and skips, with the reason for each skip', () => {
    expect(
      summarizeImport(
        report(['Good'], [['bad.excalidraw', 'This file is not a valid Excalidraw drawing.']]),
      ),
    ).toEqual({
      message:
        '1 imported, 1 skipped: bad.excalidraw: This file is not a valid Excalidraw drawing.',
      error: false,
    });
  });

  it('lists two reasons and counts the rest', () => {
    const notice = summarizeImport(
      report(
        ['Good'],
        [
          ['a.txt', 'Not supported.'],
          ['b.txt', 'Not supported.'],
          ['c.txt', 'Not supported.'],
        ],
      ),
    );
    expect(notice.message).toBe(
      '1 imported, 3 skipped: a.txt: Not supported. b.txt: Not supported. and 1 more',
    );
  });

  it('is an error when nothing at all was imported', () => {
    expect(
      summarizeImport(
        report(
          [],
          [
            ['a.txt', 'No.'],
            ['b.txt', 'No.'],
          ],
        ),
      ).error,
    ).toBe(true);
  });
});
