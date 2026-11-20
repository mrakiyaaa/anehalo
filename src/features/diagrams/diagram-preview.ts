/**
 * Diagrams cannot be saved until a later phase, so release builds hide them. Development and
 * debug (E2E) builds show them; scripts/build-desktop.mjs sets VITE_DIAGRAM_PREVIEW for --debug.
 */
export const diagramPreviewEnabled =
  import.meta.env.DEV || import.meta.env.VITE_DIAGRAM_PREVIEW === '1';
