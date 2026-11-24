import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ExportToast } from '@/features/export/ExportToast';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { DropImportZone } from './DropImportZone';
import { LargeImportDialog } from './LargeImportDialog';
import type { ImportCandidate } from './DiagramImportService';
import { candidateFromFile } from './import-candidate';
import { DiagramImportContext } from './import-context';
import { summarizeImport, type ImportNotice } from './import-summary';

interface PendingConfirmation {
  readonly candidate: ImportCandidate;
  readonly answer: (importAnyway: boolean) => void;
}

/** The accepted file types, for the picker; the service still checks every file itself. */
const pickerTypes = '.excalidraw,.png,.svg,image/png,image/svg+xml';

/**
 * Imports diagrams from the file picker and from dropped files, asks before large ones, and
 * reports each import in one toast. Provides nothing when the vault cannot hold diagrams.
 */
export function DiagramImportProvider({ children }: PropsWithChildren) {
  const diagramsAvailable = useWorkspaceStore((state) => state.diagramsAvailable);
  const importDiagramFiles = useWorkspaceStore((state) => state.importDiagramFiles);
  const picker = useRef<HTMLInputElement>(null);
  const pickerFolder = useRef<string | null>(null);
  const importing = useRef(false);
  const [notice, setNotice] = useState<ImportNotice | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const confirmLarge = useCallback(
    (candidate: ImportCandidate) =>
      new Promise<boolean>((resolve) => {
        setConfirmation({
          candidate,
          answer: (importAnyway) => {
            setConfirmation(null);
            resolve(importAnyway);
          },
        });
      }),
    [],
  );

  const importFiles = useCallback(
    async (files: readonly File[], folder: string | null) => {
      if (files.length === 0 || importing.current) return;
      importing.current = true;
      setNotice(null);
      try {
        const result = await importDiagramFiles(files.map(candidateFromFile), folder, confirmLarge);
        setNotice(
          result.ok
            ? summarizeImport(result.value)
            : { message: result.error.message, error: true },
        );
      } finally {
        importing.current = false;
      }
    },
    [importDiagramFiles, confirmLarge],
  );

  const controls = useMemo(
    () => ({
      importFiles,
      chooseFiles: (folder: string | null) => {
        pickerFolder.current = folder;
        picker.current?.click();
      },
    }),
    [importFiles],
  );

  if (!diagramsAvailable) return <>{children}</>;
  return (
    <DiagramImportContext.Provider value={controls}>
      {children}
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={pickerTypes}
        aria-label="Choose diagrams to import"
        data-testid="diagram-import-input"
        onChange={(event) => {
          // The list is copied first: clearing the input empties it.
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void importFiles(files, pickerFolder.current);
        }}
      />
      <DropImportZone />
      {confirmation && (
        <LargeImportDialog
          name={confirmation.candidate.name}
          size={confirmation.candidate.size}
          onAnswer={confirmation.answer}
        />
      )}
      {notice && (
        <ExportToast
          message={notice.message}
          {...(notice.error ? { error: true } : {})}
          onDismiss={() => setNotice(null)}
        />
      )}
    </DiagramImportContext.Provider>
  );
}
