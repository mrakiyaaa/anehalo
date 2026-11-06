import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes, Definition } from 'mdast';
import { decodeNotePath, encodeNotePath, escapeLinkText } from './note-link-paths';
import { isInsideFolder, pathName } from '@/features/storage/storage-paths';

export interface LinkRename {
  readonly previousPath: string;
  readonly nextPath: string;
  readonly folder?: boolean;
}

export interface MarkdownNoteLink {
  readonly path: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly title: string | null;
}

function nodeText(node: Nodes): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map(nodeText).join('') : '';
}

export function scanNoteLinks(markdown: string): readonly MarkdownNoteLink[] {
  const root = fromMarkdown(markdown);
  const definitions = new Map<string, Definition>();
  function collect(node: Nodes) {
    if (node.type === 'definition' && !definitions.has(node.identifier))
      definitions.set(node.identifier, node);
    if ('children' in node) node.children.forEach(collect);
  }
  collect(root);
  const links: MarkdownNoteLink[] = [];
  function visit(node: Nodes) {
    if (node.type === 'link' || node.type === 'linkReference') {
      const destination = node.type === 'link' ? node : definitions.get(node.identifier);
      const path = decodeNotePath(destination?.url ?? '');
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (path.ok && start !== undefined && end !== undefined) {
        const labelStart = node.children[0]?.position?.start.offset;
        const labelEnd = node.children.at(-1)?.position?.end.offset;
        links.push({
          path: path.value,
          text: nodeText(node),
          start,
          end,
          label:
            labelStart !== undefined && labelEnd !== undefined
              ? markdown.slice(labelStart, labelEnd)
              : '',
          title: destination?.title ?? null,
        });
      }
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  }
  visit(root);
  return links;
}

export function renamedLink(path: string, text: string, rename: LinkRename) {
  const matches = rename.folder
    ? isInsideFolder(path, rename.previousPath)
    : path === rename.previousPath;
  if (!matches) return null;
  const nextPath = `${rename.nextPath}${path.slice(rename.previousPath.length)}`;
  const previousTitle = pathName(path).replace(/\.md$/i, '');
  const nextTitle = pathName(nextPath).replace(/\.md$/i, '');
  return { path: nextPath, text: text === previousTitle ? nextTitle : text };
}

export function rewriteNoteLinks(markdown: string, rename: LinkRename): string {
  let rewritten = markdown;
  for (const link of [...scanNoteLinks(markdown)].reverse()) {
    const next = renamedLink(link.path, link.text, rename);
    if (!next) continue;
    const label = next.text === link.text ? link.label : escapeLinkText(next.text);
    const title = link.title ? ` "${link.title.replace(/[\\"]/g, '\\$&')}"` : '';
    rewritten = `${rewritten.slice(0, link.start)}[${label}](${encodeNotePath(next.path)}${title})${rewritten.slice(link.end)}`;
  }
  return rewritten;
}
