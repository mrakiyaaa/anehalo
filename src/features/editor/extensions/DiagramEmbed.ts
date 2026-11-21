import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DiagramEmbedView } from '@/features/note-links/DiagramEmbedView';
import {
  decodeItemPath,
  encodeNotePath,
  validateItemPath,
} from '@/features/note-links/note-link-paths';
import { itemKind } from '@/features/storage/vault-items';
import { renderImageMarkdown } from './ImageAttachment';

/** The diagram path of an image reference, or null for an ordinary image. */
function diagramPath(reference: string): string | null {
  const path = decodeItemPath(reference);
  return path.ok && itemKind(path.value) === 'diagram' ? path.value : null;
}

function escapeTitle(title: string) {
  return title.replace(/[[\]\\]/g, '\\$&').replace(/[\r\n]/g, ' ');
}

/**
 * `![Title](Folder/Diagram.excalidraw)`: a read-only preview of a diagram inside a note. It is
 * ordinary Markdown image syntax, so other apps show the title; every other image is left to
 * the image node exactly as before.
 */
export const DiagramEmbed = Node.create({
  name: 'diagramEmbed',
  // Above Image so `image` Markdown tokens reach this parser first, but below the paragraph:
  // the highest-ranked block becomes the editor's default block for replaced text.
  priority: 150,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ path: { default: '' }, title: { default: '' } }),
  parseHTML: () => [
    {
      tag: 'figure[data-diagram-embed]',
      getAttrs: (element) => {
        const path = diagramPath(element.getAttribute('data-path') ?? '');
        return path ? { path, title: element.getAttribute('data-title') ?? '' } : false;
      },
    },
  ],
  renderHTML: ({ node }) => {
    const title = String(node.attrs.title ?? '');
    const path = validateItemPath(String(node.attrs.path ?? ''));
    return path.ok
      ? [
          'figure',
          {
            'data-diagram-embed': '',
            'data-path': encodeNotePath(path.value),
            'data-title': title,
          },
          title,
        ]
      : ['p', {}, title];
  },
  renderText: ({ node }) => String(node.attrs.title ?? ''),
  markdownTokenName: 'image',
  parseMarkdown: (token, helpers) => {
    const reference = String(token.href ?? '');
    const path = diagramPath(reference);
    return path
      ? helpers.createNode('diagramEmbed', { path, title: String(token.text ?? '') })
      : helpers.createNode('image', {
          src: reference,
          title: typeof token.title === 'string' ? token.title : null,
          alt: String(token.text ?? ''),
        });
  },
  // The Markdown serializer looks renderers up by token name first, so image nodes arrive here.
  renderMarkdown: (node) => {
    if (node.type !== 'diagramEmbed') return renderImageMarkdown(node);
    const title = escapeTitle(String(node.attrs?.title ?? ''));
    const path = validateItemPath(String(node.attrs?.path ?? ''));
    return path.ok ? `![${title}](${encodeNotePath(path.value)})` : title;
  },
  addNodeView: () => ReactNodeViewRenderer(DiagramEmbedView),
});
