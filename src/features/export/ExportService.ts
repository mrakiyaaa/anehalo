import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { prepareExportImages, skippedDiagramsWarning } from './export-images';
import { exportFileName, exportFolder } from './export-file-names';
import { pdfOptions, type PdfExporter } from './PdfExporter';
import type {
  ExportAction,
  ExportImage,
  ExportOutcome,
  ExportPlatform,
  ExportSource,
} from './export-types';

export interface ExportSettings {
  lastFolder: () => string | null;
  rememberFolder: (path: string) => Promise<RepositoryResult<void>>;
}
const notDrawable = () =>
  Promise.resolve(
    failure({ code: 'unavailable', message: 'Diagrams cannot be drawn here.' } as const),
  );

export class ExportService {
  constructor(
    private readonly repository: NoteRepository,
    private readonly platform: ExportPlatform,
    private readonly pdf: PdfExporter,
    private readonly currentDraft: (path: string) => ExportSource | null,
    private readonly settings: ExportSettings,
    /** Draws an embedded diagram as a PNG; without it, embeds export as unavailable. */
    private readonly drawDiagram?: (path: string) => Promise<RepositoryResult<ExportImage>>,
  ) {}

  async execute(
    path: string,
    action: ExportAction,
    progress: (message: string, fraction: number) => void = () => {},
  ): Promise<RepositoryResult<ExportOutcome>> {
    try {
      progress('Preparing export…', 0);
      const [
        { buildExportDocument, withExportEditor },
        { transformExportDocument },
        { buildPrintHtml },
        { cleanMarkdown },
      ] = await Promise.all([
        import('./buildExportDocument'),
        import('./transform-export-document'),
        import('./buildPrintHtml'),
        import('./cleanMarkdown'),
      ]);
      const draft = this.currentDraft(path);
      const read = draft ? success(draft) : await this.repository.readNote(path);
      if (!read.ok) return read;
      const source = buildExportDocument(read.value);
      const extension = action === 'save-pdf' ? 'pdf' : 'md';
      let destination: string | undefined;
      if (action.startsWith('save-')) {
        const choice = await this.platform.chooseDestination(
          exportFileName(source.title, extension),
          extension,
          this.settings.lastFolder(),
        );
        if (!choice.ok) return choice;
        if (!choice.value) return success({ status: 'cancelled' });
        if (!choice.value.toLowerCase().endsWith(`.${extension}`))
          return failure({
            code: 'invalid-name',
            message: `Choose a file name ending in .${extension}.`,
          });
        destination = choice.value;
      }
      progress('Preparing images…', 0.05);
      // Copy as Markdown keeps diagram embeds as written; every other export shows them as images.
      const images = await prepareExportImages(
        source,
        this.platform,
        action === 'save-markdown' ? destination : undefined,
        action === 'copy-markdown' ? undefined : (this.drawDiagram ?? notDrawable),
      );
      if (!images.ok) return images;
      const skipped = skippedDiagramsWarning(images.value.unavailableDiagrams);
      if (!destination) {
        const markdown = cleanMarkdown(
          source,
          images.value.references,
          images.value.unavailableDiagrams,
        );
        const rich =
          action === 'copy-rich-text' ? buildPrintHtml(source, images.value.references) : undefined;
        const text = rich
          ? withExportEditor(transformExportDocument(source, { clean: true }), (editor) =>
              editor.getText({ blockSeparator: '\n\n' }),
            )
          : markdown;
        const copied = await this.platform.writeClipboard(text, rich);
        return copied.ok
          ? success({
              status: 'copied',
              message: rich ? 'Copied as rich text' : 'Copied as Markdown',
              ...(skipped ? { warning: skipped } : {}),
            })
          : copied;
      }
      let bytes: Uint8Array;
      if (action === 'save-pdf') {
        const rendered = await this.pdf.generate(
          buildPrintHtml(source, images.value.references),
          pdfOptions,
          (fraction) => progress('Rendering PDF…', 0.1 + fraction * 0.85),
        );
        if (!rendered.ok) return rendered;
        bytes = rendered.value;
      } else
        bytes = new TextEncoder().encode(
          cleanMarkdown(source, images.value.references, images.value.unavailableDiagrams),
        );
      progress('Saving export…', 0.98);
      const written = await this.platform.writeBundle({
        path: destination,
        bytes,
        assets: action === 'save-markdown' ? images.value.assets : [],
      });
      if (!written.ok) return written;
      const remembered = await this.settings.rememberFolder(exportFolder(destination));
      return success({
        status: 'saved',
        message: extension === 'pdf' ? 'Saved PDF' : 'Saved Markdown',
        path: destination,
        ...(!remembered.ok || skipped
          ? {
              warning: [
                skipped,
                remembered.ok
                  ? null
                  : 'The file was saved, but the last export folder could not be remembered.',
              ]
                .filter(Boolean)
                .join(' '),
            }
          : {}),
      });
    } catch (error) {
      return failure(describeStorageError(error, 'Could not export the note.'));
    }
  }
  reveal(path: string) {
    return this.platform.revealFile(path);
  }
}
