import { describe, expect, it } from 'vitest';
import { classifyElementLink, diagramElementLinks, rewriteElementLinks } from './element-links';

function diagramWithLinks(...links: (string | null)[]) {
  return JSON.stringify(
    {
      type: 'excalidraw',
      elements: links.map((link, index) => ({ id: `shape-${index}`, type: 'rectangle', link })),
    },
    null,
    2,
  );
}

describe('diagram element links', () => {
  it.each([
    ['Notes/Plan.md', { kind: 'item', path: 'Notes/Plan.md' }],
    ['Plans/My%20Flow.excalidraw', { kind: 'item', path: 'Plans/My Flow.excalidraw' }],
    ['සටහන්/සිංහල සටහන.md', { kind: 'item', path: 'සටහන්/සිංහල සටහන.md' }],
    ['https://example.com/docs', { kind: 'web', url: 'https://example.com/docs' }],
    ['http://example.com', { kind: 'web', url: 'http://example.com' }],
    ['javascript:alert(1)', { kind: 'blocked' }],
    ['file:///C:/Windows/notepad.exe', { kind: 'blocked' }],
    ['../Outside.md', { kind: 'blocked' }],
    ['/Absolute.md', { kind: 'blocked' }],
    ['Plan.md?x=1', { kind: 'blocked' }],
    ['mailto:someone@example.com', { kind: 'blocked' }],
    ['Photo.png', { kind: 'blocked' }],
  ])('classifies %s', (link, expected) => {
    expect(classifyElementLink(link)).toEqual(expected);
  });

  it('indexes vault links from the file, ignoring web links and deleted shapes', () => {
    const text = JSON.stringify({
      type: 'excalidraw',
      elements: [
        { id: 'a', link: 'Notes/Plan.md' },
        { id: 'b', link: 'https://example.com' },
        { id: 'c', link: 'Old.md', isDeleted: true },
        { id: 'd', link: 'Flow.excalidraw' },
      ],
    });
    expect(diagramElementLinks(text)).toEqual(['Notes/Plan.md', 'Flow.excalidraw']);
    expect(diagramElementLinks('{"type":"excal')).toEqual([]);
  });

  it('follows a renamed note, keeping each link spelled as it was', () => {
    const text = diagramWithLinks('Notes/My%20Plan.md', 'Notes/My Plan.md', 'Other.md', null);
    const rewritten = rewriteElementLinks(text, {
      previousPath: 'Notes/My Plan.md',
      nextPath: 'Archive/Final plan.md',
    });
    expect(diagramElementLinks(rewritten)).toEqual(['Archive/Final plan.md', 'Other.md']);
    const links = (JSON.parse(rewritten) as { elements: { link: string | null }[] }).elements.map(
      ({ link }) => link,
    );
    expect(links).toEqual(['Archive/Final%20plan.md', 'Archive/Final plan.md', 'Other.md', null]);
  });

  it('follows a renamed folder', () => {
    const text = diagramWithLinks('Work/Plan.md', 'Work/Deep/Flow.excalidraw', 'Workspace/X.md');
    const rewritten = rewriteElementLinks(text, {
      previousPath: 'Work',
      nextPath: 'Projects',
      folder: true,
    });
    expect(diagramElementLinks(rewritten)).toEqual([
      'Projects/Plan.md',
      'Projects/Deep/Flow.excalidraw',
      'Workspace/X.md',
    ]);
  });

  it.each([
    ['a space', 'Notes/My Plan.md', 'Notes/My%20Plan.md'],
    ['a Sinhala name', 'සටහන්/සිංහල සටහන.md', 'සටහන්/සිංහල%20සටහන.md'],
    ['a Tamil name', 'குறிப்புகள்/தமிழ் குறிப்பு.md', 'குறிப்புகள்/தமிழ்%20குறிப்பு.md'],
  ])(
    'finds a link to a path with %s whether it is written encoded or plain',
    (_case, path, written) => {
      const rename = { previousPath: path, nextPath: 'Renamed.md' };
      for (const link of [written, path, encodeURI(path)]) {
        const rewritten = rewriteElementLinks(diagramWithLinks(link), rename);
        expect(diagramElementLinks(rewritten)).toEqual(['Renamed.md']);
      }
    },
  );

  it('does not parse or change a diagram that cannot mention the renamed path', () => {
    const text = diagramWithLinks('Other.md');
    expect(
      rewriteElementLinks(text, { previousPath: 'Notes/Plan.md', nextPath: 'Plan 2.md' }),
    ).toBe(text);
    const unreadable = '{"elements": [{"link": "Notes/Plan.md"';
    expect(
      rewriteElementLinks(unreadable, { previousPath: 'Notes/Plan.md', nextPath: 'Plan 2.md' }),
    ).toBe(unreadable);
  });
});
