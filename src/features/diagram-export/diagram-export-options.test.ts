import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { createSettingsStore } from '@/features/settings/settings-store';
import { unwrapResult } from '@/test/repository-helpers';
import {
  defaultDiagramExportOptions,
  excalidrawExportAppState,
  exceedsCanvasLimits,
  parseDiagramExportOptions,
  selectionElements,
  type DiagramExportOptions,
} from './diagram-export-options';

const options = (patch: Partial<DiagramExportOptions> = {}): DiagramExportOptions => ({
  ...defaultDiagramExportOptions,
  ...patch,
});

describe('option to Excalidraw parameter mapping', () => {
  it('maps every option to the matching export field', () => {
    expect(
      excalidrawExportAppState(
        options({ format: 'png', background: false, theme: 'dark', scale: 3, embedScene: true }),
      ),
    ).toEqual({
      exportBackground: false,
      exportWithDarkMode: true,
      exportEmbedScene: true,
      exportScale: 3,
    });
    expect(
      excalidrawExportAppState(options({ background: true, theme: 'light', embedScene: false })),
    ).toMatchObject({ exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false });
  });

  it('keeps SVG at its natural size, whatever scale is remembered', () => {
    expect(excalidrawExportAppState(options({ format: 'svg', scale: 3 })).exportScale).toBe(1);
  });
});

describe('remembered options', () => {
  it('falls back field by field for missing or invalid values', () => {
    expect(parseDiagramExportOptions(undefined)).toEqual(defaultDiagramExportOptions);
    expect(parseDiagramExportOptions('png')).toEqual(defaultDiagramExportOptions);
    expect(
      parseDiagramExportOptions({
        format: 'gif',
        theme: 'dark',
        scale: 4,
        background: 'yes',
        embedScene: true,
      }),
    ).toEqual(options({ theme: 'dark', embedScene: true }));
  });

  it('are saved in settings.json and read back on the next start', async () => {
    const repository = new InMemorySettingsRepository(
      JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
    );
    const store = createSettingsStore(repository);
    await store.getState().load();
    const chosen = options({ format: 'svg', theme: 'dark', scale: 1, embedScene: true });
    unwrapResult(await store.getState().update({ diagramExport: chosen }));

    expect(JSON.parse(repository.file.content ?? '{}')).toMatchObject({ diagramExport: chosen });
    expect(unwrapResult(await repository.load()).diagramExport).toEqual(chosen);
  });

  it('are the defaults for settings written before diagram export existed', async () => {
    const older: Record<string, unknown> = { ...defaultSettings('Memory/Anehalo') };
    delete older.diagramExport;
    const repository = new InMemorySettingsRepository(
      JSON.stringify({ ...older, onboardingCompleted: true }),
    );
    expect(unwrapResult(await repository.load()).diagramExport).toEqual(
      defaultDiagramExportOptions,
    );
  });
});

describe('selection only', () => {
  const elements = [
    { id: 'box', type: 'rectangle' },
    { id: 'label', type: 'text', containerId: 'box' },
    { id: 'other', type: 'ellipse' },
    { id: 'frame', type: 'frame' },
    { id: 'inside', type: 'rectangle', frameId: 'frame' },
    { id: 'outside', type: 'rectangle', frameId: null },
  ];

  it('includes the text bound to a selected shape', () => {
    expect(selectionElements(elements, new Set(['box'])).map(({ id }) => id)).toEqual([
      'box',
      'label',
    ]);
  });

  it('includes everything inside a selected frame, and nothing else', () => {
    expect(selectionElements(elements, new Set(['frame'])).map(({ id }) => id)).toEqual([
      'frame',
      'inside',
    ]);
  });

  it('is empty when nothing is selected', () => {
    expect(selectionElements(elements, new Set())).toEqual([]);
  });
});

describe('canvas limits', () => {
  it('accepts ordinary sizes and refuses a side browsers cannot draw', () => {
    expect(exceedsCanvasLimits(3_000, 2_000)).toBe(false);
    expect(exceedsCanvasLimits(16_384, 16_384)).toBe(false);
    expect(exceedsCanvasLimits(16_385, 100)).toBe(true);
    expect(exceedsCanvasLimits(100, 20_000)).toBe(true);
  });
});
