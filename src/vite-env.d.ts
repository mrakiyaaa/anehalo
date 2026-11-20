/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in debug desktop builds, which show the diagram preview; see diagram-preview.ts. */
  readonly VITE_DIAGRAM_PREVIEW?: string;
}
