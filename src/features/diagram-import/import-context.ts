import { createContext, useContext } from 'react';

export interface DiagramImportControls {
  /** Opens the system file picker; the files go to the folder (the vault root for null). */
  readonly chooseFiles: (folder: string | null) => void;
  /** Imports files the app already holds, such as dropped ones. */
  readonly importFiles: (files: readonly File[], folder: string | null) => Promise<void>;
}

export const DiagramImportContext = createContext<DiagramImportControls | null>(null);

/** The import controls, or null where diagrams cannot be imported (so menus leave them out). */
export function useDiagramImport(): DiagramImportControls | null {
  return useContext(DiagramImportContext);
}
