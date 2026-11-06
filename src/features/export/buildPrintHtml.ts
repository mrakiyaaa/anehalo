import DOMPurify from 'dompurify';
import { withExportEditor } from './buildExportDocument';
import { transformExportDocument } from './transform-export-document';
import type { ExportDocument } from './export-types';
import {
  isTextColor,
  isTextSize,
  textColors,
  textSizes,
} from '@/features/editor/formatting-options';
import { lightToken } from './light-palette';

export function buildPrintHtml(
  source: ExportDocument,
  images: ReadonlyMap<string, string> = new Map(),
): string {
  const html = withExportEditor(
    transformExportDocument(source, { clean: false, printTitle: true }),
    (editor) => editor.getHTML(),
  );
  const document = new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html');
  const root = document.createElement('div');
  root.append(...document.body.childNodes);
  root.className = 'export-print';
  root.style.cssText = `color:${lightToken('--ink')};background:${lightToken('--surface')};font-family:'Figtree Variable','Noto Sans Sinhala Variable','Noto Sans Tamil Variable',sans-serif;font-size:14px;line-height:1.7;overflow-wrap:anywhere;color-scheme:light;text-align:left;`;
  const styles: Readonly<Record<string, string>> = {
    'h1,h2,h3,h4,h5,h6':
      "font-family:'Fredoka Variable','Noto Sans Sinhala Variable','Noto Sans Tamil Variable',sans-serif;font-weight:500;line-height:1.3;margin:20px 0 10px;",
    h1: 'font-size:30px;',
    h2: 'font-size:24px;',
    h3: 'font-size:20px;',
    p: 'margin:0 0 12px;',
    'ul,ol': 'padding-left:24px;margin:0 0 14px;',
    ul: 'list-style-type:disc;',
    ol: 'list-style-type:decimal;',
    li: 'margin:3px 0;',
    blockquote: `border-left:3px solid ${lightToken('--lilac-fg')};background:${lightToken('--lilac-bg')};margin:16px 0;padding:10px 16px;border-radius:0 10px 10px 0;`,
    code: `font-family:Consolas,'Noto Sans Sinhala Variable','Noto Sans Tamil Variable',monospace;font-size:.88em;background:${lightToken('--sidebar')};padding:2px 5px;border-radius:4px;`,
    pre: `white-space:pre-wrap;tab-size:2;background:${lightToken('--sidebar')};border:1px solid ${lightToken('--line')};padding:14px;border-radius:10px;margin:16px 0;`,
    'pre code': 'background:transparent;padding:0;border:0;',
    a: `color:${lightToken('--accent')};text-decoration:underline;text-underline-offset:2px;`,
    mark: `background:${lightToken('--butter-bg')};color:inherit;padding:1px 2px;border-radius:3px;`,
    table: `width:100%;border-collapse:collapse;table-layout:fixed;margin:16px 0;`,
    'th,td': `border:1px solid ${lightToken('--line')};padding:8px;vertical-align:top;word-break:break-word;`,
    th: `background:${lightToken('--sidebar')};font-weight:600;`,
    'td p,th p,li p': 'margin:0;',
    hr: `border:0;border-top:1px solid ${lightToken('--line')};margin:22px 0;`,
    img: 'display:block;max-width:100%;max-height:940px;width:auto;height:auto;object-fit:contain;margin:12px 0;',
  };
  for (const [selector, style] of Object.entries(styles))
    for (const element of root.querySelectorAll<HTMLElement>(selector))
      element.style.cssText += style;
  for (const span of root.querySelectorAll<HTMLElement>('[data-color]')) {
    const color = span.dataset.color;
    if (isTextColor(color))
      span.style.color = lightToken(textColors.find((option) => option.name === color)!.token);
  }
  for (const span of root.querySelectorAll<HTMLElement>('[data-size]')) {
    const size = span.dataset.size;
    if (isTextSize(size))
      span.style.fontSize = lightToken(textSizes.find((option) => option.name === size)!.token);
  }
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    const reference = image.getAttribute('src') ?? '';
    const resolved = images.get(reference);
    if (resolved && /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=]+$/i.test(resolved))
      image.src = resolved;
    else image.remove();
  }
  for (const list of root.querySelectorAll<HTMLElement>('ul[data-type="taskList"]'))
    list.style.listStyle = 'none';
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const box = document.createElement('span');
    box.textContent = input.hasAttribute('checked') ? '☑' : '☐';
    box.style.cssText =
      'display:inline-block;min-width:18px;margin-right:6px;font-family:Arial,sans-serif;';
    input.closest('label')?.replaceWith(box);
  }
  for (const item of root.querySelectorAll<HTMLElement>('li[data-type="taskItem"]')) {
    item.style.cssText += 'display:flex;align-items:flex-start;';
    const content = item.querySelector<HTMLElement>('div');
    if (content) content.style.flex = '1';
  }
  root.querySelector<HTMLElement>('h1')?.style.setProperty('margin-top', '0');
  return root.outerHTML;
}
