import type { MarkdownTokenizer } from '@tiptap/core';

export function htmlMarkTokenizer(
  name: string,
  tag: 'span' | 'mark',
  attribute?: string,
): MarkdownTokenizer {
  return {
    name,
    level: 'inline',
    start: (source) => source.indexOf(`<${tag}`),
    tokenize(source, _tokens, lexer) {
      const opening = new RegExp(`^<${tag}\\b([^>]*)>`, 'i').exec(source);
      if (!opening) return undefined;
      const value = attribute
        ? new RegExp(`\\bdata-${attribute}=["']([a-z]+)["']`, 'i').exec(opening[1] ?? '')?.[1]
        : undefined;
      if (attribute && !value) return undefined;
      const tags = new RegExp('\\\\[\\s\\S]|`+|</?' + tag + '\\b[^>]*>', 'gi');
      tags.lastIndex = opening[0].length;
      let depth = 1;
      for (let match = tags.exec(source); match; match = tags.exec(source)) {
        if (match[0].startsWith('\\')) continue;
        if (match[0].startsWith('`')) {
          const code = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(source.slice(match.index));
          if (code) tags.lastIndex = match.index + code[0].length;
          continue;
        }
        depth += match[0].startsWith('</') ? -1 : 1;
        if (depth !== 0) continue;
        const text = source.slice(opening[0].length, match.index);
        return {
          type: name,
          raw: source.slice(0, tags.lastIndex),
          text,
          value,
          tokens: lexer.inlineTokens(text),
        };
      }
      return undefined;
    },
  };
}
