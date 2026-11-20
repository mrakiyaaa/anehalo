import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { withExportEditor } from './buildExportDocument';
import { transformExportDocument } from './transform-export-document';
import type { ExportDocument } from './export-types';
import { unavailableDiagramText, type EmbeddedDiagram } from './export-images';
import { escapeLinkText } from '@/features/note-links/note-link-paths';

/**
 * The exported Markdown: images (and diagrams drawn as images) point at their exported copies;
 * diagrams that could not be drawn become a line of text. Without either, embeds stay as written.
 */
export function cleanMarkdown(
  source: ExportDocument,
  images: ReadonlyMap<string, string> = new Map(),
  unavailableDiagrams: readonly EmbeddedDiagram[] = [],
): string {
  const unavailable = new Map(unavailableDiagrams.map((diagram) => [diagram.reference, diagram]));
  const markdown = withExportEditor(transformExportDocument(source, { clean: true }), (editor) =>
    editor.getMarkdown(),
  );
  const replacements: { start: number; end: number; text: string }[] = [];
  function visit(node: Nodes) {
    const missing = node.type === 'image' ? unavailable.get(node.url) : undefined;
    if (missing) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined)
        replacements.push({ start, end, text: escapeLinkText(unavailableDiagramText(missing)) });
    } else if (node.type === 'image' && images.has(node.url)) {
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
