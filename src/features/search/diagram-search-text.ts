import type { StoredElement } from '@/features/diagrams/DiagramContentScan';
import { storedElements } from '@/features/diagrams/stored-elements';

/** Where one element's words sit in a diagram's search text, so a match can find its element. */
export interface DiagramTextSegment {
  readonly elementId: string;
  readonly start: number;
  readonly end: number;
}

export interface DiagramSearchText {
  readonly text: string;
  readonly segments: readonly DiagramTextSegment[];
}

const frameTypes = new Set(['frame', 'magicframe']);

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.replace(/\s+/gu, ' ').trim() : null;
}

/**
 * The searchable words of one element and the element a match should select: text bound inside
 * a shape or arrow selects its container. Links are never searchable text.
 */
function elementWords(
  element: StoredElement,
  live: ReadonlySet<string>,
): { elementId: string; words: string } | null {
  if (element.isDeleted === true || typeof element.id !== 'string') return null;
  if (element.type === 'text') {
    const words = nonEmpty(element.originalText) ?? nonEmpty(element.text);
    if (!words) return null;
    const container = typeof element.containerId === 'string' ? element.containerId : null;
    return { elementId: container && live.has(container) ? container : element.id, words };
  }
  if (typeof element.type === 'string' && frameTypes.has(element.type)) {
    const words = nonEmpty(element.name);
    return words ? { elementId: element.id, words } : null;
  }
  return null;
}

/** The search text of a diagram's elements, from a file or from the in-memory scene. */
export function searchTextFromElements(elements: readonly StoredElement[]): DiagramSearchText {
  const live = new Set(
    elements.flatMap((element) =>
      element.isDeleted !== true && typeof element.id === 'string' ? [element.id] : [],
    ),
  );
  let text = '';
  const segments: DiagramTextSegment[] = [];
  for (const element of elements) {
    const found = elementWords(element, live);
    if (!found) continue;
    if (text) text += ' ';
    segments.push({
      elementId: found.elementId,
      start: text.length,
      end: text.length + found.words.length,
    });
    text += found.words;
  }
  return { text, segments };
}

/** A stored diagram's search text, or null when the file is not a readable diagram. */
export function extractDiagramSearchText(json: string): DiagramSearchText | null {
  const stored = storedElements(json);
  return stored ? searchTextFromElements(stored.elements) : null;
}

/** The element whose words contain a position in the search text. */
export function elementAt(
  segments: readonly DiagramTextSegment[],
  position: number,
): string | null {
  return (
    segments.find((segment) => position >= segment.start && position < segment.end)?.elementId ??
    null
  );
}
