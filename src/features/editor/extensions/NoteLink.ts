import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NoteLinkView } from '@/features/note-links/NoteLinkView';
import {
  decodeItemPath,
  encodeNotePath,
  escapeLinkText,
  isItemReference,
  validateItemPath,
} from '@/features/note-links/note-link-paths';

/** A link chip to a note or a diagram; the node keeps its original name so documents stay valid. */
export const NoteLink = Node.create({
  name: 'noteLink',
  priority: 1100,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ path: { default: '' }, label: { default: '' } }),
  parseHTML: () => [
    {
      tag: 'a[href]',
      priority: 100,
      getAttrs: (element) => {
        const path = decodeItemPath(element.getAttribute('href') ?? '');
        return path.ok ? { path: path.value, label: element.textContent ?? '' } : false;
      },
    },
  ],
  renderHTML: ({ node }) => {
    const path: unknown = node.attrs.path;
    const label = String(node.attrs.label ?? '');
    if (typeof path !== 'string') return ['span', {}, label];
    const validated = validateItemPath(path);
    return validated.ok
      ? ['a', { href: encodeNotePath(validated.value), 'data-note-link': '' }, label]
      : ['span', {}, label];
  },
  renderText: ({ node }) => String(node.attrs.label ?? ''),
  markdownTokenName: 'link',
  parseMarkdown: (token, helpers) => {
    const reference = String(token.href ?? '');
    if (!isItemReference(reference))
      return helpers.applyMark('link', helpers.parseInline(token.tokens ?? []), {
        href: reference,
        title: typeof token.title === 'string' ? token.title : null,
      });
    const path = decodeItemPath(reference);
    const content = helpers.parseInline(token.tokens ?? []);
    const label = content.map((node) => node.text ?? '').join('') || String(token.text ?? '');
    return path.ok
      ? helpers.createNode('noteLink', { path: path.value, label })
      : helpers.createTextNode(label);
  },
  renderMarkdown: (node) => {
    const path = String(node.attrs?.path ?? '');
    const label = escapeLinkText(String(node.attrs?.label ?? ''));
    const validated = validateItemPath(path);
    return validated.ok ? `[${label}](${encodeNotePath(validated.value)})` : label;
  },
  addNodeView: () => ReactNodeViewRenderer(NoteLinkView),
});
