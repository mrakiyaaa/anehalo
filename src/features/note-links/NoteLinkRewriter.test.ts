import { describe, expect, it } from 'vitest';
import { decodeNotePath, encodeNotePath } from './note-link-paths';
import { rewriteNoteLinks, scanNoteLinks } from './NoteLinkRewriter';

describe('vault note paths', () => {
  it.each([
    'Folder/Note name.md',
    'Ideas/Tea & cake #1 (draft).md',
    '日本語/100% ready.md',
    "What's next.md",
  ])('encodes and decodes %s', (path) => {
    expect(decodeNotePath(encodeNotePath(path))).toEqual({ ok: true, value: path });
    expect(encodeNotePath(path)).not.toMatch(/[ ()#']/);
  });
  it.each([
    '../Outside.md',
    '%2e%2e/Outside.md',
    'Folder/%2E%2E/Outside.md',
    '/Outside.md',
    '//server/Note.md',
    'C:/Note.md',
    'file:///Note.md',
    'Folder%5C..%5COutside.md',
    '.trash/Note.md',
    'Bad%GG.md',
    'Note.md?x.md',
    'Note#fragment.md',
  ])('rejects %s', (reference) => {
    expect(decodeNotePath(reference).ok).toBe(false);
  });
});

describe('Markdown link rewriting', () => {
  const rename = { previousPath: 'Work/Old title.md', nextPath: 'Work/New & title.md' };
  it('updates matching labels but preserves custom labels and unrelated bytes', () => {
    const source =
      '  Intro\r\n\r\n[Old title](Work/Old%20title.md) and [my **label**](Work/Old%20title.md "hint").\r\n';
    expect(rewriteNoteLinks(source, rename)).toBe(
      '  Intro\r\n\r\n[New & title](Work/New%20%26%20title.md) and [my **label**](Work/New%20%26%20title.md "hint").\r\n',
    );
  });
  it('rewrites nested folder paths without matching a sibling prefix', () => {
    expect(
      rewriteNoteLinks('[A](Work/Sub/A.md) [B](Workroom/B.md)', {
        previousPath: 'Work',
        nextPath: 'Projects',
        folder: true,
      }),
    ).toBe('[A](Projects/Sub/A.md) [B](Workroom/B.md)');
  });
  it('leaves fenced, indented, inline and nested code, images, HTML and web links untouched', () => {
    const source = [
      '```md',
      '[Old title](Work/Old%20title.md)',
      '```',
      '',
      '    [Old title](Work/Old%20title.md)',
      '',
      '`[Old title](Work/Old%20title.md)`',
      '',
      '> ```',
      '> [Old title](Work/Old%20title.md)',
      '> ```',
      '',
      '![Old title](Work/Old%20title.md)',
      '[Old title](https://example.com/Work/Old%20title.md)',
      '',
      '<div>[Old title](Work/Old%20title.md)</div>',
    ].join('\n');
    expect(rewriteNoteLinks(source, rename)).toBe(source);
    expect(scanNoteLinks(source)).toEqual([]);
  });
  it('finds links in lists, quotes and reference links', () => {
    const source =
      '- [Old title](Work/Old%20title.md)\n\n> [Old title][target]\n\n[target]: Work/Old%20title.md\n';
    expect(scanNoteLinks(source)).toHaveLength(2);
    expect(rewriteNoteLinks(source, rename)).toContain(
      '> [New & title](Work/New%20%26%20title.md)',
    );
  });
  it('does not write a different source when nothing matches', () => {
    const source = '[Different](Other.md)\r\n\r\n';
    expect(rewriteNoteLinks(source, rename)).toBe(source);
  });
});
