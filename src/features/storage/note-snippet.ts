const namedEntities: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^\s*(`{3,}|~{3,}).*$/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, '')
    .replace(/\[([ xX])\]\s+/g, '')
    .replace(/(\*{1,3}|_{1,3}|~~)(.*?)\1/g, '$2')
    .replace(/`+/g, '')
    .replace(
      /&([a-z]+);/gi,
      (entity: string, name: string) => namedEntities[name.toLowerCase()] ?? entity,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity: string, number: string) => {
      const codePoint = number.startsWith('x')
        ? Number.parseInt(number.slice(1), 16)
        : Number(number);
      return codePoint >= 0 &&
        codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSnippet(plainText: string): string {
  const characters = [...plainText];
  return characters.length <= 120 ? plainText : `${characters.slice(0, 119).join('').trimEnd()}…`;
}
