import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import '@fontsource-variable/noto-sans-sinhala';
import '@fontsource-variable/noto-sans-tamil';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { PdfExporter, PdfOptions } from './PdfExporter';
import { paginatePrintContent, printIntervals, type PrintChunk } from './pdf-pagination';
import { installCanvasFontMetricsFix } from './canvas-font-metrics';
import { lightToken } from './light-palette';

const pixelsPerMillimeter = 96 / 25.4;
const yieldToWindow = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function createPrintChunk(
  root: HTMLElement,
  chunk: PrintChunk,
  maximumHeight: number,
): HTMLElement {
  const page = root.cloneNode(false) as HTMLElement;
  const scale = Math.min(1, maximumHeight / (chunk.end - chunk.start));
  page.style.cssText += `position:fixed;left:0;top:0;z-index:-1;width:${root.clientWidth}px;height:${Math.min(maximumHeight, chunk.end - chunk.start)}px;overflow:hidden;pointer-events:none;`;
  const inner = document.createElement('div');
  inner.style.cssText = `position:relative;transform-origin:top left;transform:scale(${scale});width:${root.clientWidth}px;height:${chunk.end - chunk.start}px;`;
  const origin = root.getBoundingClientRect().top;
  for (const element of root.children) {
    const rectangle = element.getBoundingClientRect();
    const top = rectangle.top - origin;
    if (top >= chunk.end || rectangle.bottom - origin <= chunk.start) continue;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.cssText += `position:absolute;left:0;top:${top - chunk.start}px;width:${rectangle.width}px;margin-top:0;margin-bottom:0;`;
    inner.append(clone);
  }
  page.append(inner);
  document.body.append(page);
  return page;
}

async function waitForPrintResources(root: HTMLElement) {
  await Promise.all([
    document.fonts.load('14px "Figtree Variable"', 'Anehalo'),
    document.fonts.load('30px "Fredoka Variable"', 'Anehalo'),
    document.fonts.load('14px "Noto Sans Sinhala Variable"', 'සිංහල'),
    document.fonts.load('14px "Noto Sans Tamil Variable"', 'தமிழ்'),
  ]);
  await document.fonts.ready;
  for (const image of root.querySelectorAll('img')) await image.decode();
}

export class CanvasPdfExporter implements PdfExporter {
  async generate(
    html: string,
    options: PdfOptions,
    progress: (fraction: number) => void,
  ): Promise<RepositoryResult<Uint8Array>> {
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${170 * pixelsPerMillimeter}px;pointer-events:none;`;
    host.innerHTML = html;
    document.body.append(host);
    const restoreFontMetrics = installCanvasFontMetricsFix();
    try {
      const root = host.firstElementChild;
      if (!(root instanceof HTMLElement)) throw new Error('The printable note is empty.');
      root.style.width = '100%';
      await waitForPrintResources(root);
      const pageHeight = (297 - options.margins * 2) * pixelsPerMillimeter;
      const chunks = paginatePrintContent(
        root.getBoundingClientRect().height,
        pageHeight,
        printIntervals(root),
      );
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: options.format,
        compress: true,
      });
      for (const [index, chunk] of chunks.entries()) {
        await yieldToWindow();
        const page = createPrintChunk(root, chunk, pageHeight);
        try {
          const canvas = await html2canvas(page, {
            scale: options.scale,
            backgroundColor: lightToken('--surface'),
            logging: false,
            width: root.clientWidth,
            height: Math.ceil(Math.min(pageHeight, chunk.end - chunk.start)),
            imageTimeout: 15000,
          });
          if (index > 0) pdf.addPage();
          pdf.addImage(
            canvas.toDataURL('image/jpeg', 0.96),
            'JPEG',
            options.margins,
            options.margins,
            170,
            canvas.height / options.scale / pixelsPerMillimeter,
            undefined,
            'FAST',
          );
          canvas.width = 0;
          canvas.height = 0;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(lightToken('--subtle-ink'));
          pdf.text(`${index + 1} / ${chunks.length}`, 105, 287, { align: 'center' });
          progress((index + 1) / chunks.length);
        } finally {
          page.remove();
        }
      }
      return success(new Uint8Array(pdf.output('arraybuffer')));
    } catch (error) {
      return failure(describeStorageError(error, 'Could not render the PDF.'));
    } finally {
      host.remove();
      restoreFontMetrics();
    }
  }
}
