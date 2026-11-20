import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { unwrapResult } from '@/test/repository-helpers';
import { ExportService } from './ExportService';
import { InMemoryExportPlatform } from './InMemoryExportPlatform';
import type { ExportImage } from './export-types';
import type { PdfExporter } from './PdfExporter';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));

const note = 'Intro\n\n![Release flow](Plans/Release%20flow.excalidraw)\n\nOutro';
const png: ExportImage = {
  name: 'Release flow.png',
  bytes: new Uint8Array([137, 80, 78, 71]),
  mimeType: 'image/png',
};

function setup(draw: (path: string) => Promise<RepositoryResult<ExportImage>>) {
  const repository = new InMemoryNoteRepository([
    { relativePath: 'Work/Plan.md', type: 'file', content: note },
  ]);
  const platform = new InMemoryExportPlatform();
  platform.destination = 'C:/Exports/Plan.md';
  const engine: PdfExporter = {
    generate: vi.fn<PdfExporter['generate']>().mockResolvedValue(success(new Uint8Array([1]))),
  };
  const drawDiagram = vi.fn(draw);
  const service = new ExportService(
    repository,
    platform,
    engine,
    () => null,
    { lastFolder: () => null, rememberFolder: () => Promise.resolve(success(undefined)) },
    drawDiagram,
  );
  return { repository, platform, engine, service, drawDiagram };
}

afterEach(() => logFailure.mockClear());

describe('exporting notes with embedded diagrams', () => {
  it('saves each embedded diagram as a PNG asset and links it as an image', async () => {
    const { service, platform, repository, drawDiagram } = setup(() =>
      Promise.resolve(success(png)),
    );
    const outcome = unwrapResult(await service.execute('Work/Plan.md', 'save-markdown'));
    expect(outcome).toMatchObject({ status: 'saved' });
    expect(outcome.warning).toBeUndefined();
    expect(drawDiagram).toHaveBeenCalledWith('Plans/Release flow.excalidraw');
    const bundle = platform.bundles[0];
    expect(bundle?.assets.map((asset) => asset.name)).toEqual(['Release flow.png']);
    const markdown = new TextDecoder().decode(bundle?.bytes);
    expect(markdown).toMatch(/!\[Release flow\]\([^)]*Release%20flow\.png\)/);
    expect(markdown).not.toContain('.excalidraw');
    expect(unwrapResult(await repository.readNote('Work/Plan.md')).content).toBe(note);
  });

  it('keeps the embed syntax when copying Markdown, without drawing anything', async () => {
    const { service, platform, drawDiagram } = setup(() => Promise.resolve(success(png)));
    unwrapResult(await service.execute('Work/Plan.md', 'copy-markdown'));
    expect(platform.clipboard[0]?.text).toContain(
      '![Release flow](Plans/Release%20flow.excalidraw)',
    );
    expect(drawDiagram).not.toHaveBeenCalled();
  });

  it('copies rich text and prints PDFs with the diagram as an image', async () => {
    const { service, platform, engine } = setup(() => Promise.resolve(success(png)));
    unwrapResult(await service.execute('Work/Plan.md', 'copy-rich-text'));
    expect(platform.clipboard[0]?.html).toMatch(/<img[^>]+src="data:image\/png;base64,/);
    platform.destination = 'C:/Exports/Plan.pdf';
    unwrapResult(await service.execute('Work/Plan.md', 'save-pdf'));
    expect(vi.mocked(engine.generate).mock.calls[0]?.[0]).toMatch(
      /<img[^>]+src="data:image\/png;base64,/,
    );
  });

  it('finishes the export with a placeholder when a diagram cannot be drawn', async () => {
    const { service, platform } = setup(() =>
      Promise.resolve(failure({ code: 'invalid-diagram', message: 'Broken drawing.' })),
    );
    const outcome = unwrapResult(await service.execute('Work/Plan.md', 'save-markdown'));
    expect(outcome.status).toBe('saved');
    expect(outcome.warning).toBe(
      'Exported without a diagram that could not be drawn: Release flow.',
    );
    const markdown = new TextDecoder().decode(platform.bundles[0]?.bytes);
    expect(markdown).toContain('Diagram unavailable: Release flow');
    expect(markdown).toContain('Intro');
    expect(markdown).toContain('Outro');
    expect(platform.bundles[0]?.assets).toEqual([]);
    expect(logFailure).toHaveBeenCalledWith('diagram-export-failed', 'invalid-diagram');

    unwrapResult(await service.execute('Work/Plan.md', 'copy-rich-text'));
    expect(platform.clipboard[0]?.html).toContain('Diagram unavailable: Release flow');
  });
});
