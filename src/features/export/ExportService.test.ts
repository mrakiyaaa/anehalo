import { describe, expect, it, vi } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { success, failure } from '@/features/storage/repository-result';
import { unwrapResult } from '@/test/repository-helpers';
import { ExportService } from './ExportService';
import { InMemoryExportPlatform } from './InMemoryExportPlatform';
import { pdfOptions, type PdfExporter } from './PdfExporter';

function setup(content = '**Hello**') {
  const repository = new InMemoryNoteRepository([
    { relativePath: 'Work/My note.md', type: 'file', content },
  ]);
  const platform = new InMemoryExportPlatform();
  const generate = vi
    .fn<PdfExporter['generate']>()
    .mockResolvedValue(success(new Uint8Array([37, 80, 68, 70])));
  const engine: PdfExporter = { generate };
  const remember = vi.fn().mockResolvedValue(success(undefined));
  const service = new ExportService(repository, platform, engine, () => null, {
    lastFolder: () => 'C:/Exports',
    rememberFolder: remember,
  });
  return { repository, platform, engine, generate, remember, service };
}
describe('note export service', () => {
  it('copies clean Markdown through the clipboard port', async () => {
    const { service, platform } = setup();
    expect(unwrapResult(await service.execute('Work/My note.md', 'copy-markdown'))).toEqual({
      status: 'copied',
      message: 'Copied as Markdown',
    });
    expect(platform.clipboard).toEqual([{ text: '# My note\n\n**Hello**' }]);
  });
  it('copies styled rich HTML with a plain text fallback', async () => {
    const { service, platform } = setup();
    expect(unwrapResult(await service.execute('Work/My note.md', 'copy-rich-text')).message).toBe(
      'Copied as rich text',
    );
    expect(platform.clipboard[0]?.html).toContain('<strong>Hello</strong>');
    expect(platform.clipboard[0]?.text).toBe('My note\n\nHello');
  });
  it('uses the current draft, including an unsaved title and content', async () => {
    const { repository, platform, engine } = setup('Old disk text');
    const service = new ExportService(
      repository,
      platform,
      engine,
      () => ({ title: 'Unsaved title', relativePath: 'Work/My note.md', content: 'Latest words' }),
      { lastFolder: () => null, rememberFolder: () => Promise.resolve(success(undefined)) },
    );
    const read = vi.spyOn(repository, 'readNote');
    unwrapResult(await service.execute('Work/My note.md', 'copy-markdown'));
    expect(platform.clipboard[0]?.text).toBe('# Unsaved title\n\nLatest words');
    expect(read).not.toHaveBeenCalled();
    expect(unwrapResult(await repository.readNote('Work/My note.md')).content).toBe(
      'Old disk text',
    );
  });
  it('cancels without loading images, writing files or remembering a folder', async () => {
    const { platform, service, remember } = setup('![Photo](../.attachments/photo.png)');
    const load = vi.spyOn(platform, 'loadImage');
    expect(unwrapResult(await service.execute('Work/My note.md', 'save-markdown'))).toEqual({
      status: 'cancelled',
    });
    expect(load).not.toHaveBeenCalled();
    expect(platform.bundles).toEqual([]);
    expect(remember).not.toHaveBeenCalled();
  });
  it('saves Markdown with the default file name and remembers the selected folder', async () => {
    const { platform, service, remember } = setup();
    platform.destination = 'D:/Output/My note.md';
    expect(unwrapResult(await service.execute('Work/My note.md', 'save-markdown'))).toMatchObject({
      status: 'saved',
      message: 'Saved Markdown',
      path: platform.destination,
    });
    expect(platform.dialogs).toEqual([
      { fileName: 'My note.md', extension: 'md', lastFolder: 'C:/Exports' },
    ]);
    expect(platform.bundles[0]?.assets).toEqual([]);
    expect(remember).toHaveBeenCalledWith('D:/Output');
  });
  it('copies images into the adjacent assets folder and rewrites relative paths', async () => {
    const { platform, service } = setup(
      '![Photo](../.attachments/photo.png) ![Again](../.attachments/photo.png)',
    );
    const bytes = new Uint8Array([1, 2, 3]);
    platform.images.set('../.attachments/photo.png', {
      name: 'photo.png',
      bytes,
      mimeType: 'image/png',
    });
    platform.destination = 'D:/Output/Shared note.md';
    unwrapResult(await service.execute('Work/My note.md', 'save-markdown'));
    expect(platform.bundles[0]?.assets).toEqual([{ name: 'photo.png', bytes }]);
    expect(new TextDecoder().decode(platform.bundles[0]?.bytes)).toContain(
      '![Photo](Shared%20note_assets/photo.png) ![Again](Shared%20note_assets/photo.png)',
    );
  });
  it('makes clipboard Markdown images portable without writing files', async () => {
    const { platform, service } = setup('![Photo](../.attachments/photo.png)');
    platform.images.set('../.attachments/photo.png', {
      name: 'photo.png',
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
    });
    unwrapResult(await service.execute('Work/My note.md', 'copy-markdown'));
    expect(platform.clipboard[0]?.text).toContain('![Photo](data:image/png;base64,AQID)');
    expect(platform.bundles).toEqual([]);
  });
  it('returns a clear error on write failure without a partial bundle', async () => {
    const { platform, service, remember } = setup();
    platform.destination = 'D:/Output/Note.md';
    platform.failWrites = true;
    const result = await service.execute('Work/My note.md', 'save-markdown');
    expect(result).toEqual(
      failure({
        code: 'permission-denied',
        message: 'Could not save the file. Check that the folder is writable.',
      }),
    );
    expect(platform.bundles).toEqual([]);
    expect(remember).not.toHaveBeenCalled();
  });
  it('does not write anything when an attachment is missing', async () => {
    const { platform, service } = setup('![Photo](../.attachments/missing.png)');
    platform.destination = 'D:/Output/Note.md';
    expect((await service.execute('Work/My note.md', 'save-markdown')).ok).toBe(false);
    expect(platform.bundles).toEqual([]);
  });
  it('passes A4, 20mm margins, light palette and scale 2 to the PDF engine', async () => {
    const { platform, service, generate } = setup('<span data-color="rose">Color</span>');
    platform.destination = 'D:/Output/Note.pdf';
    unwrapResult(await service.execute('Work/My note.md', 'save-pdf'));
    expect(generate).toHaveBeenCalledWith(
      expect.stringContaining('color-scheme: light'),
      pdfOptions,
      expect.any(Function),
    );
    expect(platform.bundles[0]?.bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(platform.bundles[0]?.assets).toEqual([]);
  });
});
