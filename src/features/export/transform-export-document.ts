import type { JSONContent } from '@tiptap/core';
import type { ExportDocument } from './export-types';

export function transformExportDocument(
  source: ExportDocument,
  options: { clean: boolean; images?: ReadonlyMap<string, string>; printTitle?: boolean },
): JSONContent {
  function transform(node: JSONContent): JSONContent {
    const marks = node.marks?.filter(
      (mark) => !options.clean || !['textColor', 'textSize'].includes(mark.type),
    );
    if (node.type === 'noteLink')
      return {
        type: 'text',
        text: String(node.attrs?.label ?? ''),
        ...(marks?.length ? { marks } : {}),
      };
    return {
      ...node,
      ...(marks ? { marks } : {}),
      ...(node.content
        ? {
            content: node.content
              .map(transform)
              .filter((child) => child.type !== 'text' || child.text !== ''),
          }
        : {}),
      ...(node.type === 'image' && options.images?.has(String(node.attrs?.src))
        ? { attrs: { ...node.attrs, src: options.images.get(String(node.attrs?.src)) } }
        : {}),
    };
  }
  const document = transform(source.document);
  const first = document.content?.[0];
  const startsWithHeading = first?.type === 'heading' && first.attrs?.level === 1;
  const headingText = (first?.content ?? []).map((node) => node.text ?? '').join('');
  if (!startsWithHeading || (options.printTitle && headingText !== source.title))
    document.content = [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: source.title || 'Untitled note' }],
      },
      ...(document.content ?? []),
    ];
  return document;
}
