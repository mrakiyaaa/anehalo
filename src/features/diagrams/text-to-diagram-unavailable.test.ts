import { describe, expect, it } from 'vitest';

describe('Mermaid (text-to-diagram) is never available', () => {
  it('resolves Excalidraw’s Mermaid import to a stub that refuses', async () => {
    // Excalidraw loads this package for its text-to-diagram dialog and for pasted Mermaid
    // text. vite.config.ts aliases it, so every one of those paths gets the stub instead.
    const mermaid = await import('@excalidraw/mermaid-to-excalidraw');

    await expect(mermaid.parseMermaidToExcalidraw('flowchart TD\n  A --> B')).rejects.toThrow(
      'Mermaid diagrams are not available in Anehalo.',
    );
  });
});
