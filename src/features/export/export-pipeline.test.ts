import { describe, expect, it } from 'vitest';
import { buildExportDocument } from './buildExportDocument';
import { cleanMarkdown } from './cleanMarkdown';
import { buildPrintHtml } from './buildPrintHtml';
import { exportFileName } from './export-file-names';
import { paginatePrintContent } from './pdf-pagination';

function document(content: string, title = 'My note') {
  return buildExportDocument({ content, title, relativePath: 'Work/My note.md' });
}
describe('one export document pipeline', () => {
  it('strips color and size spans, retains underline and highlight, and flattens note links only', () => {
    const source = document(
      '<span data-color="mint"><span data-size="huge">Colored</span></span> <u>underlined</u> <mark>highlighted</mark> [My title](Work/My%20title.md) [Website](https://example.com)',
    );
    const markdown = cleanMarkdown(source);
    expect(markdown).toContain('Colored');
    expect(markdown).not.toContain('<span');
    expect(markdown).toContain('<u>underlined</u>');
    expect(markdown).toContain('<mark>highlighted</mark>');
    expect(markdown).toContain('My title');
    expect(markdown).not.toContain('Work/My');
    expect(markdown).toContain('[Website](https://example.com)');
  });
  it('retains standard formatting, checklists, tables and literal code', () => {
    const source = document(
      '## Heading\n\n**Bold** *italic* ~~strike~~ `code`\n\n- [ ] Open\n- [x] Done\n\n> Quote\n\n| Name | Value |\n| --- | --- |\n| Key | Text |\n\n```html\n<span data-color="mint">literal</span> [Note](Note.md)\n```',
    );
    const markdown = cleanMarkdown(source);
    for (const expected of [
      '## Heading',
      '**Bold**',
      '*italic*',
      '~~strike~~',
      '`code`',
      '- [ ] Open',
      '- [x] Done',
      '> Quote',
      '| Name | Value |',
      '<span data-color="mint">literal</span> [Note](Note.md)',
    ])
      expect(markdown).toContain(expected);
  });
  it('adds an H1 only when the document does not start with one', () => {
    expect(cleanMarkdown(document('Body'))).toBe('# My note\n\nBody');
    expect(cleanMarkdown(document('# Existing\n\nBody'))).toBe('# Existing\n\nBody');
    expect(cleanMarkdown(document('## Smaller'))).toBe('# My note\n\n## Smaller');
  });
  it('rewrites images to the selected bundle references', () => {
    expect(
      cleanMarkdown(
        document('![Photo](../.attachments/photo.png)'),
        new Map([['../.attachments/photo.png', 'My%20note_assets/photo.png']]),
      ),
    ).toContain('![Photo](My%20note_assets/photo.png)');
  });
  it('builds safe light HTML with semantic colors, sizes, boxes and plain note titles', () => {
    const source = document(
      '<span data-color="mint"><span data-size="large">Soft text</span></span> [Note](Note.md) [Web](https://example.com)\n\n- [x] Done\n- [ ] Open\n\n<script>alert(1)</script>',
    );
    const html = buildPrintHtml(source);
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    expect(body.textContent).toContain('☑');
    expect(body.textContent).toContain('☐');
    expect(body.querySelector('[data-color="mint"]')?.getAttribute('style')).toContain(
      'rgb(26, 122, 79)',
    );
    expect(body.querySelector('[data-size="large"]')?.getAttribute('style')).toContain('1.25em');
    expect(body.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(body.querySelector('script')).toBeNull();
    expect(html).not.toContain('href="Note.md"');
    expect(html).toContain('color-scheme: light');
    expect(html).toContain('Figtree Variable');
    expect(html).toContain('Fredoka Variable');
  });
  it('embeds only prepared raster images in printable HTML', () => {
    const image = 'data:image/png;base64,AQID';
    const html = buildPrintHtml(
      document('![Photo](../.attachments/photo.png)'),
      new Map([['../.attachments/photo.png', image]]),
    );
    expect(
      new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src'),
    ).toBe(image);
  });
});
describe('Windows export file names', () => {
  it.each([
    ['A:/\\*?"<>| plan. ', 'A plan.md'],
    ['CON', '_CON.md'],
    ['C:ON', '_CON.md'],
    ['COM1', '_COM1.md'],
    ['NUL.txt', '_NUL.txt.md'],
    ['...', 'Untitled note.md'],
  ])('sanitizes %s', (title, expected) => {
    expect(exportFileName(title, 'md')).toBe(expected);
  });
  it('limits length and replaces an existing export extension', () => {
    expect(exportFileName('A'.repeat(100), 'pdf')).toHaveLength(84);
    expect(exportFileName('Title.md', 'pdf')).toBe('Title.pdf');
  });
});
describe('PDF page boundaries', () => {
  it('moves a break before a line, image or row instead of cutting it', () => {
    const chunks = paginatePrintContent(300, 100, [
      { top: 90, bottom: 110 },
      { top: 180, bottom: 230 },
    ]);
    expect(chunks).toEqual([
      { start: 0, end: 90 },
      { start: 90, end: 180 },
      { start: 180, end: 280 },
      { start: 280, end: 300 },
    ]);
  });
  it('keeps an oversized row together for scaling into a single page', () => {
    expect(paginatePrintContent(200, 100, [{ top: 0, bottom: 160 }])).toEqual([
      { start: 0, end: 160 },
      { start: 160, end: 200 },
    ]);
  });
});
