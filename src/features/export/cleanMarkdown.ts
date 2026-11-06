import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { withExportEditor } from './buildExportDocument';
import { transformExportDocument } from './transform-export-document';
import type { ExportDocument } from './export-types';

export function cleanMarkdown(
  source: ExportDocument,
  images: ReadonlyMap<string, string> = new Map(),
): string {
  const markdown = withExportEditor(transformExportDocument(source, { clean: true }), (editor) =>
    editor.getMarkdown(),
  );
  const replacements: { start: number; end: number; text: string }[] = [];
  function visit(node: Nodes) {
    if (node.type === 'image' && images.has(node.url)) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        const label = (node.alt ?? '').replace(/[\\[\]]/g, '\\$&');
        const title = node.title ? ` "${node.title.replace(/[\\"]/g, '\\$&')}"` : '';
        replacements.push({ start, end, text: `![${label}](${images.get(node.url)}${title})` });
      }
    }
    if ('children' in node) node.children.forEach(visit);
  }
  visit(fromMarkdown(markdown));
  return replacements
    .sort((first, second) => second.start - first.start)
    .reduce(
      (text, replacement) =>
        text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end),
      markdown,
    );
}
