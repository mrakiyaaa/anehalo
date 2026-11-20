import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes, Definition } from 'mdast';
import { decodeItemPath, encodeNotePath, escapeLinkText } from './note-link-paths';
import { isInsideFolder, pathName } from '@/features/storage/storage-paths';
import { itemKind } from '@/features/storage/vault-items';

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
  /** `![…](diagram.excalidraw)`: a diagram shown inside the note rather than linked. */
  readonly embed: boolean;
}

function nodeText(node: Nodes): string {
  if ('value' in node) return node.value;
  if (node.type === 'image') return node.alt ?? '';
  return 'children' in node ? node.children.map(nodeText).join('') : '';
}

/**
 * Links to notes and diagrams, and diagram embeds, in a note's Markdown. Images of anything
 * else are attachments, not vault links.
 */
export function scanVaultLinks(markdown: string): readonly MarkdownNoteLink[] {
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
    if (node.type === 'image' || node.type === 'imageReference') {
      const destination = node.type === 'image' ? node : definitions.get(node.identifier);
      const path = decodeItemPath(destination?.url ?? '');
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (path.ok && itemKind(path.value) === 'diagram' && start !== undefined && end !== undefined)
        links.push({
          path: path.value,
          text: node.alt ?? '',
          start,
          end,
          label: escapeLinkText(node.alt ?? ''),
          title: destination?.title ?? null,
          embed: true,
        });
      return;
    }
    if (node.type === 'link' || node.type === 'linkReference') {
      const destination = node.type === 'link' ? node : definitions.get(node.identifier);
      const path = decodeItemPath(destination?.url ?? '');
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
          embed: false,
        });
      }
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  }
  visit(root);
  return links;
}

/** The original name, kept so existing callers and tests read the same. */
export const scanNoteLinks = scanVaultLinks;

function titleOf(path: string) {
  return pathName(path).replace(/\.(md|excalidraw)$/i, '');
}

export function renamedLink(path: string, text: string, rename: LinkRename) {
  const matches = rename.folder
    ? isInsideFolder(path, rename.previousPath)
    : path === rename.previousPath;
  if (!matches) return null;
  const nextPath = `${rename.nextPath}${path.slice(rename.previousPath.length)}`;
  return { path: nextPath, text: text === titleOf(path) ? titleOf(nextPath) : text };
}

/**
 * Whether a file's text can mention the renamed path at all, in any spelling a link may use:
 * plain (`My Diagram.excalidraw`, Sinhala and Tamil names as typed), fully encoded as Markdown
 * writes it, with only spaces encoded (`සිංහල%20රූපය`), or as a browser encodes a URI. Case is
 * ignored, so the check never skips a real match; it only spares parsing large diagram files
 * that cannot contain the path.
 */
export function mayReferTo(text: string, rename: LinkRename): boolean {
  const haystack = text.toLowerCase();
  const path = rename.previousPath;
  return [path, encodeNotePath(path), path.replaceAll(' ', '%20'), encodeURI(path)].some((form) =>
    haystack.includes(form.toLowerCase()),
  );
}

export function rewriteNoteLinks(markdown: string, rename: LinkRename): string {
  let rewritten = markdown;
  for (const link of [...scanVaultLinks(markdown)].reverse()) {
    const next = renamedLink(link.path, link.text, rename);
    if (!next) continue;
    const label = next.text === link.text ? link.label : escapeLinkText(next.text);
    const title = link.title ? ` "${link.title.replace(/[\\"]/g, '\\$&')}"` : '';
    rewritten = `${rewritten.slice(0, link.start)}${link.embed ? '!' : ''}[${label}](${encodeNotePath(next.path)}${title})${rewritten.slice(link.end)}`;
  }
  return rewritten;
}
