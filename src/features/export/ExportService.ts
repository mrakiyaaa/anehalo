import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { buildExportDocument, withExportEditor } from './buildExportDocument';
import { transformExportDocument } from './transform-export-document';
import { buildPrintHtml } from './buildPrintHtml';
import { cleanMarkdown } from './cleanMarkdown';
import { prepareExportImages } from './export-images';
import { exportFileName, exportFolder } from './export-file-names';
import { pdfOptions, type PdfExporter } from './PdfExporter';
import type { ExportAction, ExportOutcome, ExportPlatform, ExportSource } from './export-types';

export interface ExportSettings {
  lastFolder: () => string | null;
  rememberFolder: (path: string) => Promise<RepositoryResult<void>>;
}
export class ExportService {
  constructor(
    private readonly repository: NoteRepository,
    private readonly platform: ExportPlatform,
    private readonly pdf: PdfExporter,
    private readonly currentDraft: (path: string) => ExportSource | null,
    private readonly settings: ExportSettings,
  ) {}

  async execute(
    path: string,
    action: ExportAction,
    progress: (message: string, fraction: number) => void = () => {},
  ): Promise<RepositoryResult<ExportOutcome>> {
    try {
      progress('Preparing export…', 0);
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
      const images = await prepareExportImages(
        source,
        this.platform,
        action === 'save-markdown' ? destination : undefined,
      );
      if (!images.ok) return images;
      if (!destination) {
        const markdown = cleanMarkdown(source, images.value.references);
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
      } else bytes = new TextEncoder().encode(cleanMarkdown(source, images.value.references));
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
        ...(!remembered.ok
          ? { warning: 'The file was saved, but the last export folder could not be remembered.' }
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
