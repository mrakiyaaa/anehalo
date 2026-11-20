/**
 * Stands in for @excalidraw/mermaid-to-excalidraw (see the alias in vite.config.ts), so Mermaid
 * is never bundled or loaded. Excalidraw loads that package for its text-to-diagram dialog and
 * whenever pasted text looks like Mermaid; on this rejection, a paste falls back to plain text.
 */
export function parseMermaidToExcalidraw(): Promise<never> {
  return Promise.reject(new Error('Mermaid diagrams are not available in Anehalo.'));
}
