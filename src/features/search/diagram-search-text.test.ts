import { describe, expect, it } from 'vitest';
import { elementAt, extractDiagramSearchText, searchTextFromElements } from './diagram-search-text';

const file = (elements: object[]) => JSON.stringify({ type: 'excalidraw', elements });

describe('diagram search text', () => {
  it('reads text elements, preferring the original text over the wrapped text', () => {
    const extracted = extractDiagramSearchText(
      file([
        { id: 'a', type: 'text', text: 'Pay-\nment', originalText: 'Payment gateway' },
        { id: 'b', type: 'text', text: 'Retry  twice' },
      ]),
    );
    expect(extracted).toEqual({
      text: 'Payment gateway Retry twice',
      segments: [
        { elementId: 'a', start: 0, end: 15 },
        { elementId: 'b', start: 16, end: 27 },
      ],
    });
  });

  it('attributes text bound inside a shape or arrow to its container', () => {
    const extracted = searchTextFromElements([
      { id: 'box', type: 'rectangle' },
      { id: 'label', type: 'text', text: 'Checkout', containerId: 'box' },
      { id: 'arrow', type: 'arrow' },
      { id: 'arrow-label', type: 'text', text: 'calls', containerId: 'arrow' },
      { id: 'orphan', type: 'text', text: 'loose', containerId: 'gone' },
    ]);
    expect(extracted.segments.map(({ elementId }) => elementId)).toEqual([
      'box',
      'arrow',
      'orphan',
    ]);
  });

  it('includes named frames and skips deleted elements, links and other shapes', () => {
    const extracted = searchTextFromElements([
      { id: 'f', type: 'frame', name: 'Release plan' },
      { id: 'm', type: 'magicframe', name: 'සිංහල රාමුව' },
      { id: 'unnamed', type: 'frame', name: null },
      { id: 'x', type: 'text', text: 'Removed', isDeleted: true },
      { id: 'l', type: 'rectangle', link: 'https://example.com/secret' },
      { id: 'linked-text', type: 'text', text: 'Docs', link: 'Plans/Hidden name.md' },
      { id: 't', type: 'text', text: 'தமிழ் உரை' },
    ]);
    expect(extracted.text).toBe('Release plan සිංහල රාමුව Docs தமிழ் உரை');
    expect(extracted.text).not.toContain('example');
    expect(extracted.text).not.toContain('Hidden');
  });

  it('returns null for a file that is not a readable diagram', () => {
    expect(extractDiagramSearchText('{"type":"excal')).toBeNull();
    expect(extractDiagramSearchText('{"type":"excalidraw"}')).toBeNull();
    expect(extractDiagramSearchText('[]')).toBeNull();
  });

  it('finds the element at a position in the text', () => {
    const { segments } = searchTextFromElements([
      { id: 'a', type: 'text', text: 'One' },
      { id: 'b', type: 'text', text: 'Two' },
    ]);
    expect(elementAt(segments, 0)).toBe('a');
    expect(elementAt(segments, 4)).toBe('b');
    expect(elementAt(segments, 99)).toBeNull();
  });
});
