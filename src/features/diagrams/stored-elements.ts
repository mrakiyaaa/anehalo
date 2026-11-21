import type { StoredElement } from './DiagramContentScan';

/**
 * A diagram file's parsed JSON and its elements, or null when it is not a readable diagram. Plain
 * JSON only, with no imports, so the search worker can use it and Excalidraw is never loaded.
 */
export function storedElements(text: string): { parsed: object; elements: StoredElement[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not an error here: each caller decides what an unreadable diagram means for it.
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !('elements' in parsed)) return null;
  return Array.isArray(parsed.elements)
    ? { parsed, elements: parsed.elements as StoredElement[] }
    : null;
}
