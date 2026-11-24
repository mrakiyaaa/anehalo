import { decodeItemPath, encodeNotePath } from '@/features/note-links/note-link-paths';
import { mayReferTo, renamedLink, type LinkRename } from '@/features/note-links/NoteLinkRewriter';
import { isWebLink } from './web-links';
import type { StoredElement } from '@/features/diagrams/DiagramContentScan';
import { storedElements } from '@/features/diagrams/stored-elements';

/** What a link on a diagram element points at, and so how Anehalo may open it. */
export type ElementLink =
  | { readonly kind: 'item'; readonly path: string }
  | { readonly kind: 'web'; readonly url: string }
  | { readonly kind: 'blocked' };

/**
 * Vault-relative `.md` / `.excalidraw` paths open in the app; http(s) links open in the default
 * browser; everything else (other schemes, absolute or escaping paths) is refused.
 */
export function classifyElementLink(link: string): ElementLink {
  const trimmed = link.trim();
  const item = decodeItemPath(trimmed);
  if (item.ok) return { kind: 'item', path: item.value };
  if (isWebLink(trimmed)) return { kind: 'web', url: trimmed };
  return { kind: 'blocked' };
}

/** The vault notes and diagrams that a diagram's elements link to. */
export function sceneElementLinks(elements: readonly StoredElement[]): readonly string[] {
  const paths = new Set<string>();
  for (const element of elements) {
    if (element.isDeleted === true || typeof element.link !== 'string') continue;
    const link = classifyElementLink(element.link);
    if (link.kind === 'item') paths.add(link.path);
  }
  return [...paths];
}

/**
 * The vault items linked from a diagram file, read from its JSON without loading Excalidraw.
 * Unreadable files have no links.
 */
export function diagramElementLinks(text: string): readonly string[] {
  // Most diagrams have no links at all; skip parsing large files that cannot have any.
  if (!text.includes('"link"')) return [];
  return sceneElementLinks(storedElements(text)?.elements ?? []);
}

/**
 * A diagram file with element links to a renamed or moved note, diagram or folder updated, or
 * the same text when nothing pointed there. Links keep their spelling: percent-encoded links
 * stay encoded.
 */
export function rewriteElementLinks(text: string, rename: LinkRename): string {
  if (!mayReferTo(text, rename)) return text;
  const stored = storedElements(text);
  if (!stored) return text;
  let changed = false;
  for (const element of stored.elements) {
    if (typeof element.link !== 'string') continue;
    const link = classifyElementLink(element.link);
    if (link.kind !== 'item') continue;
    const next = renamedLink(link.path, '', rename);
    if (!next) continue;
    element.link = element.link.includes('%') ? encodeNotePath(next.path) : next.path;
    changed = true;
  }
  // Excalidraw writes its files with two-space indentation.
  return changed ? JSON.stringify(stored.parsed, null, 2) : text;
}
