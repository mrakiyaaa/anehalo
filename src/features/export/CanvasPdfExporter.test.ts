import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CanvasPdfExporter } from './CanvasPdfExporter';
import { LazyPdfExporter, pdfOptions } from './PdfExporter';
import { printIntervals } from './pdf-pagination';

vi.mock('html2canvas', () => ({ default: vi.fn() }));
const pdf = vi.hoisted(() => ({
  addPage: vi.fn(),
  addImage: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  text: vi.fn(),
  output: vi.fn(() => new Uint8Array([37, 80, 68, 70]).buffer),
}));
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function () {
    return pdf;
  }),
}));

beforeEach(() => {
  vi.mocked(html2canvas).mockResolvedValue(
    Object.assign(document.createElement('canvas'), {
      toDataURL: () => 'data:image/jpeg;base64,AA==',
    }),
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(
      0,
      this.tagName === 'P' ? 20 : 0,
      640,
      this.tagName === 'ARTICLE' ? 2000 : 30,
    );
  });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});
afterEach(() => {
  document.body.replaceChildren();
});

describe('PDF rasterization and resource lifetime', () => {
  it('renders pages, numbers them, reports progress, and frees staging elements', async () => {
    const progress = vi.fn();
    const stylesBefore = document.head.querySelectorAll('style').length;
    const result = await new CanvasPdfExporter().generate(
      '<article><p>Hello</p><img src="data:image/png;base64,AA=="></article>',
      pdfOptions,
      progress,
    );
    expect(result).toEqual({ ok: true, value: new Uint8Array([37, 80, 68, 70]) });
    expect(jsPDF).toHaveBeenCalledWith({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    expect(pdf.addPage).toHaveBeenCalled();
    expect(pdf.addImage).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalledWith('1 / 3', 105, 287, { align: 'center' });
    expect(progress).toHaveBeenLastCalledWith(1);
    expect(document.body.children).toHaveLength(0);
    expect(document.head.querySelectorAll('style')).toHaveLength(stylesBefore);
  });

  it('loads the renderer lazily and returns typed errors for empty documents', async () => {
    const result = await new LazyPdfExporter().generate('', pdfOptions, () => {});
    expect(result).toMatchObject({ ok: false, error: { code: 'io-error' } });
    expect(document.body.children).toHaveLength(0);
  });

  it('removes staging pages when canvas rendering fails', async () => {
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('Canvas allocation failed'));
    const result = await new CanvasPdfExporter().generate(
      '<article><p>Large note</p></article>',
      pdfOptions,
      () => {},
    );
    expect(result).toMatchObject({ ok: false });
    expect(document.body.children).toHaveLength(0);
  });

  it('measures text, images, and table rows without duplicating table text', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>Line</p><p> </p><img><table><tbody><tr><td>Cell</td></tr></tbody></table>';
    const rectangles = [new DOMRect(0, 10, 10, 12)];
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue(
      Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null }),
    );
    expect(printIntervals(root)).toHaveLength(3);
  });
});
