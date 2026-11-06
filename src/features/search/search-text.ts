import { markdownToPlainText } from '@/features/storage/note-snippet';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';

export interface TextRange {
  start: number;
  end: number;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function normalizedText(text: string) {
  let value = '';
  const offsets: TextRange[] = [];
  for (const { segment, index } of graphemes.segment(text)) {
    // Indic vowel signs are meaningful letters, not optional Latin accents.
    const normalized = (
      /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}]/u.test(
        segment,
      )
        ? segment.normalize('NFD').replace(/\p{M}/gu, '')
        : segment.normalize('NFD')
    ).toLowerCase();
    value += normalized;
    for (let position = 0; position < normalized.length; position++)
      offsets.push({ start: index, end: index + segment.length });
  }
  return { value, offsets };
}

export function matchingRanges(text: string, query: string): TextRange[] {
  const needle = normalizedText(query).value;
  if (!needle.trim()) return [];
  const normalized = normalizedText(text);
  const ranges: TextRange[] = [];
  let position = normalized.value.indexOf(needle);
  while (position !== -1) {
    const first = normalized.offsets[position];
    const last = normalized.offsets[position + needle.length - 1];
    if (first && last) ranges.push({ start: first.start, end: last.end });
    position = normalized.value.indexOf(needle, position + needle.length);
  }
  return ranges;
}

export function searchPlainText(markdown: string): string {
  const source = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^(\s*[-+*]\s+)\[[ xX]\]\s+/gm, '$1')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, path: string, label: string | undefined) =>
        label ?? path.split('/').pop()?.replace(/\.md$/i, '') ?? '',
    );
  function read(node: Nodes): string {
    if (node.type === 'definition') return '';
    if (node.type === 'html')
      return markdownToPlainText(node.value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
    if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
    if ('children' in node)
      return node.children
        .map(read)
        .join(
          node.type === 'paragraph' || node.type === 'heading' || node.type === 'link' ? '' : ' ',
        );
    return 'value' in node ? node.value : '';
  }
  return read(fromMarkdown(source))
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchSnippet(text: string, query: string) {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  const first = terms
    .flatMap((term) => matchingRanges(text, term))
    .sort((left, right) => left.start - right.start)[0];
  const start = Math.max(0, (first?.start ?? 0) - 48);
  const snippet = `${start ? '…' : ''}${text.slice(start, start + 180)}${text.length > start + 180 ? '…' : ''}`;
  const ranges = terms
    .flatMap((term) => matchingRanges(snippet, term))
    .sort((left, right) => left.start - right.start);
  const merged: TextRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return { text: snippet, ranges: merged };
}
