import { createContext, useContext } from 'react';
import type { ExportAction, ExportOutcome, ExportProgress } from './export-types';
import type { RepositoryResult } from '@/features/storage/repository-result';
import type { DiagramExportRequest } from '@/features/diagram-export/DiagramExportService';

export interface ExportContextValue {
  progress: ExportProgress | null;
  run: (path: string, action: ExportAction) => Promise<RepositoryResult<ExportOutcome>>;
  /** Exports the open diagram; the result is also shown as a notice. */
  runDiagram: (request: DiagramExportRequest) => Promise<RepositoryResult<ExportOutcome>>;
  registerEditor: (path: string, read: () => string) => () => void;
}
export const ExportContext = createContext<ExportContextValue | null>(null);
export function useNoteExport() {
  const value = useContext(ExportContext);
  if (!value) throw new Error('Export controls must be inside ExportProvider.');
  return value;
}
