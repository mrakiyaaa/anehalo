import { beforeEach, describe, expect, it, vi } from 'vitest';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));
beforeEach(() => logFailure.mockClear());
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { failure, success } from '@/features/storage/repository-result';
import type {
  DiagramImageInput,
  DiagramImageRenderer,
} from '@/features/thumbnails/thumbnail-renderer';
import { sceneWith } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { canvasTooLargeError } from './diagram-export-errors';
import { defaultDiagramExportOptions, type DiagramExportOptions } from './diagram-export-options';
import { DiagramExportService, type DiagramExportRequest } from './DiagramExportService';

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function setup(renderer: Partial<DiagramImageRenderer> = {}) {
  const platform = new InMemoryExportPlatform();
  const drawn: DiagramImageInput[] = [];
  const remembered: string[] = [];
  let lastFolder: string | null = 'C:\\Exports';
  const service = new DiagramExportService({
    platform,
    renderer: () =>
      Promise.resolve({
        png: (input) => {
          drawn.push(input);
          return Promise.resolve(new Blob([pngBytes]));
        },
        svg: (input) => {
          drawn.push(input);
          return Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>');
        },
        ...renderer,
      }),
    serializeScene: (scene: DiagramScene) =>
      Promise.resolve(JSON.stringify({ elements: scene.elements.length })),
    settings: {
      lastFolder: () => lastFolder,
      rememberFolder: (folder) => {
        remembered.push(folder);
        lastFolder = folder;
        return Promise.resolve(success(undefined));
      },
    },
  });
  return { service, platform, drawn, remembered };
}

const source = { title: 'Release flow', scene: sceneWith('a', 'b', 'c') };

const request = (
  action: DiagramExportRequest['action'],
  options: Partial<DiagramExportOptions> = {},
  selection: readonly string[] | null = null,
): DiagramExportRequest => ({
  action,
  options: { ...defaultDiagramExportOptions, ...options },
  selection,
});

describe('saving an image', () => {
  it('asks for a name from the title, draws with the options, writes the file and remembers the folder', async () => {
    const { service, platform, drawn, remembered } = setup();
    platform.destination = 'C:\\Exports\\Release flow.png';

    const outcome = unwrapResult(
      await service.execute(source, request('save-image', { scale: 3, theme: 'dark' })),
    );

    expect(platform.dialogs).toEqual([
      { fileName: 'Release flow.png', extension: 'png', lastFolder: 'C:\\Exports' },
    ]);
    expect(drawn[0]?.options).toMatchObject({ format: 'png', scale: 3, theme: 'dark' });
    expect(drawn[0]?.elements.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(platform.bundles).toEqual([
      { path: 'C:\\Exports\\Release flow.png', bytes: pngBytes, assets: [] },
    ]);
    expect(remembered).toEqual(['C:\\Exports']);
    expect(outcome).toMatchObject({ status: 'saved', path: 'C:\\Exports\\Release flow.png' });
  });

  it('writes SVG text for the SVG format', async () => {
    const { service, platform } = setup();
    platform.destination = 'C:\\Exports\\Release flow.svg';
    unwrapResult(await service.execute(source, request('save-image', { format: 'svg' })));
    expect(platform.dialogs[0]).toMatchObject({ fileName: 'Release flow.svg', extension: 'svg' });
    expect(new TextDecoder().decode(platform.bundles[0]?.bytes)).toContain('<svg');
  });

  it('does nothing more when the save dialog is cancelled', async () => {
    const { service, platform, drawn } = setup();
    platform.destination = null;
    expect(unwrapResult(await service.execute(source, request('save-image')))).toEqual({
      status: 'cancelled',
    });
    expect(drawn).toEqual([]);
    expect(platform.bundles).toEqual([]);
  });

  it('refuses a name that does not end in the chosen format', async () => {
    const { service, platform } = setup();
    platform.destination = 'C:\\Exports\\Release flow.txt';
    const result = await service.execute(source, request('save-image'));
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-name' } });
    expect(platform.bundles).toEqual([]);
  });

  it('reports a failed write with its message and logs it', async () => {
    const { service, platform } = setup();
    platform.destination = 'C:\\Exports\\Release flow.png';
    platform.failWrites = true;
    const result = await service.execute(source, request('save-image'));
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'Could not save the file. Check that the folder is writable.' },
    });
    expect(logFailure).toHaveBeenCalledWith('diagram-export-failed', 'permission-denied');
  });

  it('warns, but still reports the save, when the folder cannot be remembered', async () => {
    const platform = new InMemoryExportPlatform();
    platform.destination = 'C:\\Exports\\Release flow.png';
    const service = new DiagramExportService({
      platform,
      renderer: () =>
        Promise.resolve({
          png: () => Promise.resolve(new Blob([pngBytes])),
          svg: () => Promise.resolve(''),
        }),
      serializeScene: () => Promise.resolve(''),
      settings: {
        lastFolder: () => null,
        rememberFolder: () =>
          Promise.resolve(failure({ code: 'io-error', message: 'settings are read-only' })),
      },
    });
    const outcome = unwrapResult(await service.execute(source, request('save-image')));
    expect(outcome.status).toBe('saved');
    expect(outcome.warning).toMatch(/last export folder could not be remembered/);
  });
});

describe('selection only and empty diagrams', () => {
  it('draws only the selected elements', async () => {
    const { service, platform, drawn } = setup();
    platform.destination = 'C:\\Exports\\Release flow.png';
    unwrapResult(await service.execute(source, request('save-image', {}, ['b'])));
    expect(drawn[0]?.elements.map(({ id }) => id)).toEqual(['b']);
  });

  it('says so, before any dialog, when nothing is left to draw', async () => {
    const { service, platform } = setup();
    const empty = { title: 'Empty', scene: sceneWith() };
    const result = await service.execute(empty, request('save-image'));
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'This diagram is empty. Draw something first.' },
    });
    expect(platform.dialogs).toEqual([]);
    const selected = await service.execute(source, request('save-image', {}, ['missing']));
    expect(selected).toMatchObject({
      ok: false,
      error: { message: 'Select something to export first.' },
    });
  });

  it('leaves out deleted elements', async () => {
    const { service, platform, drawn } = setup();
    platform.destination = 'C:\\Exports\\Release flow.png';
    const scene = {
      ...source.scene,
      elements: [...source.scene.elements, { id: 'gone', type: 'rectangle', isDeleted: true }],
    } as unknown as DiagramScene;
    unwrapResult(await service.execute({ title: 'Release flow', scene }, request('save-image')));
    expect(drawn[0]?.elements.map(({ id }) => id)).not.toContain('gone');
  });
});

describe('the clipboard', () => {
  it('copies a PNG without computing an embedded scene', async () => {
    const { service, platform, drawn } = setup();
    const outcome = unwrapResult(
      await service.execute(source, request('copy-png', { format: 'svg', embedScene: true })),
    );
    expect(platform.clipboardImages).toEqual([pngBytes]);
    expect(drawn[0]?.options).toMatchObject({ format: 'png', embedScene: false });
    expect(outcome).toMatchObject({ status: 'copied', message: 'Copied PNG to the clipboard' });
  });

  it('copies SVG as text', async () => {
    const { service, platform, drawn } = setup();
    unwrapResult(await service.execute(source, request('copy-svg', { format: 'png' })));
    expect(platform.clipboard[0]?.text).toContain('<svg');
    expect(drawn[0]?.options.format).toBe('svg');
  });

  it('reports an unavailable clipboard and logs it', async () => {
    const { service, platform } = setup();
    platform.failClipboard = true;
    expect(await service.execute(source, request('copy-png'))).toMatchObject({
      ok: false,
      error: { message: 'The clipboard is busy or unavailable. Try again.' },
    });
    expect(logFailure).toHaveBeenCalledWith('diagram-export-failed', 'unavailable');
  });
});

describe('a copy for sharing', () => {
  it('saves the whole open drawing, edits included, as a .excalidraw file', async () => {
    const { service, platform } = setup();
    platform.destination = 'C:\\Share\\Release flow.excalidraw';
    const outcome = unwrapResult(await service.execute(source, request('save-copy')));
    expect(platform.dialogs[0]).toMatchObject({
      fileName: 'Release flow.excalidraw',
      extension: 'excalidraw',
    });
    expect(new TextDecoder().decode(platform.bundles[0]?.bytes)).toBe('{"elements":3}');
    expect(outcome.message).toBe('Saved a copy of the diagram');
  });
});

describe('drawing failures', () => {
  it('suggests a lower scale when the canvas is too large', async () => {
    const options = { ...defaultDiagramExportOptions, scale: 3 } as const;
    const { service, platform } = setup({
      png: () => Promise.reject(canvasTooLargeError(options)),
    });
    platform.destination = 'C:\\Exports\\Release flow.png';
    const result = await service.execute(source, {
      action: 'save-image',
      options,
      selection: null,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'This diagram is too large to export at 3×. Try a lower scale.' },
    });
    expect(platform.bundles).toEqual([]);
  });

  it('reports an unexpected drawing failure and logs it', async () => {
    const { service } = setup({ svg: () => Promise.reject(new Error('boom')) });
    const result = await service.execute(source, request('copy-svg'));
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'This diagram could not be drawn for export.' },
    });
    expect(logFailure).toHaveBeenCalledWith('diagram-export-failed', 'unavailable');
  });
});
