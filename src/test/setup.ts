import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })),
});

afterEach(cleanup);

// ProseMirror reads selection geometry; jsdom does not perform layout.
Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => {
  const rectangles: DOMRect[] = [];
  return Object.assign(rectangles, { item: () => null });
};
HTMLElement.prototype.scrollIntoView = () => undefined;

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  },
);
