import type { RepositoryResult } from '@/features/storage/repository-result';

export const pdfOptions = { format: 'a4', margins: 20, palette: 'light', scale: 2 } as const;
export type PdfOptions = typeof pdfOptions;
export interface PdfExporter {
  generate(
    html: string,
    options: PdfOptions,
    progress: (fraction: number) => void,
  ): Promise<RepositoryResult<Uint8Array>>;
}
export class LazyPdfExporter implements PdfExporter {
  async generate(html: string, options: PdfOptions, progress: (fraction: number) => void) {
    const { CanvasPdfExporter } = await import('./CanvasPdfExporter');
    return new CanvasPdfExporter().generate(html, options, progress);
  }
}
