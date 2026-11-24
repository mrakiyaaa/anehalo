import { describe, expect, it } from 'vitest';
import {
  DiagramExportError,
  canvasTooLargeError,
  exportErrorFrom,
  exportFailureOf,
} from './diagram-export-errors';
import { defaultDiagramExportOptions, type DiagramExportOptions } from './diagram-export-options';

const png = (scale: DiagramExportOptions['scale']): DiagramExportOptions => ({
  ...defaultDiagramExportOptions,
  format: 'png',
  scale,
});

describe('export error mapping', () => {
  it('suggests a lower scale when a scaled PNG is too large', () => {
    const error = canvasTooLargeError(png(3));
    expect(error.reason).toBe('canvas-too-large');
    expect(error.message).toBe('This diagram is too large to export at 3×. Try a lower scale.');
  });

  it('suggests a selection when even 1× or SVG is too large', () => {
    expect(canvasTooLargeError(png(1)).message).toMatch(/exporting a selection/);
    expect(canvasTooLargeError({ ...png(3), format: 'svg' }).message).toMatch(/selection/);
  });

  it('recognises the silent failures browsers give for oversized canvases', () => {
    for (const failure of [
      new Error("couldn't export to blob"),
      new RangeError('Invalid array length'),
      new Error('Canvas exceeds max size'),
    ])
      expect(exportErrorFrom(failure, png(2)).reason).toBe('canvas-too-large');
  });

  it('keeps an export error as it is', () => {
    const original = new DiagramExportError('empty', 'This diagram is empty.');
    expect(exportErrorFrom(original, png(2))).toBe(original);
  });

  it('explains any other drawing failure without exposing its cause as the message', () => {
    const error = exportErrorFrom(new Error('font subsetting crashed'), png(2));
    expect(error.reason).toBe('render-failed');
    expect(error.message).toBe('This diagram could not be drawn for export.');
    expect(error.storageError.detail).toBe('font subsetting crashed');
  });

  it('gives repository-style errors for results', () => {
    expect(exportFailureOf('boom', png(1))).toMatchObject({ code: 'unavailable' });
  });
});
