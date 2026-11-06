import { useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useAppServices } from '@/app/app-services';
import { SettingsContext } from '@/features/settings/settings-context';
import { WorkspaceContext } from '@/store/workspace-context';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { failure } from '@/features/storage/repository-result';
import { ExportService } from './ExportService';
import { ExportContext } from './export-context';
import { ExportToast } from './ExportToast';
import { LazyPdfExporter } from './PdfExporter';
import type { ExportAction, ExportProgress } from './export-types';

interface ExportNotice {
  readonly message: string;
  readonly error?: boolean;
  readonly path?: string;
}
export function ExportProvider({
  repository,
  children,
}: PropsWithChildren<{ repository: NoteRepository }>) {
  const services = useAppServices();
  const workspace = useContext(WorkspaceContext);
  const settings = useContext(SettingsContext);
  if (!workspace || !settings) throw new Error('Export requires workspace and settings services.');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const busy = useRef(false);
  const [readers] = useState(() => new Map<string, () => string>());
  const service = useMemo(
    () =>
      new ExportService(
        repository,
        services.createExportPlatform(settings.getState().settings?.vaultPath ?? ''),
        new LazyPdfExporter(),
        (path) => {
          const state = workspace.getState();
          const draft = [state.openDraft, ...state.pendingDrafts].find(
            (draft) => draft?.note.relativePath === path,
          );
          return draft
            ? {
                title: draft.title,
                relativePath: draft.note.relativePath,
                content: readers.get(path)?.() ?? draft.content,
              }
            : null;
        },
        {
          lastFolder: () => settings.getState().settings?.lastExportFolder ?? null,
          rememberFolder: (folder) => settings.getState().updateLastExportFolder(folder),
        },
      ),
    [repository, services, settings, workspace, readers],
  );
  const value = useMemo(
    () => ({
      progress,
      registerEditor: (path: string, read: () => string) => {
        readers.set(path, read);
        return () => {
          if (readers.get(path) === read) readers.delete(path);
        };
      },
      run: async (path: string, action: ExportAction) => {
        if (busy.current)
          return failure({ code: 'unavailable', message: 'Another export is still in progress.' });
        busy.current = true;
        setNotice(null);
        try {
          const result = await service.execute(path, action, (message, fraction) =>
            setProgress({ path, message, fraction }),
          );
          if (!result.ok) setNotice({ message: result.error.message, error: true });
          else if (result.value.status !== 'cancelled')
            setNotice({
              message: result.value.warning ?? result.value.message ?? 'Export complete',
              ...(result.value.path ? { path: result.value.path } : {}),
              ...(result.value.warning ? { error: true } : {}),
            });
          return result;
        } finally {
          busy.current = false;
          setProgress(null);
        }
      },
    }),
    [progress, service, readers],
  );
  return (
    <ExportContext.Provider value={value}>
      {children}
      {progress && (
        <div className="export-progress" role="status">
          <span>{progress.message}</span>
          <progress max={1} value={progress.fraction} aria-label="Export progress" />
        </div>
      )}
      {notice && (
        <ExportToast
          message={notice.message}
          {...(notice.error ? { error: true } : {})}
          onDismiss={() => setNotice(null)}
          {...(notice.path
            ? {
                onReveal: () => {
                  void service.reveal(notice.path!).then((result) => {
                    if (!result.ok) setNotice({ message: result.error.message, error: true });
                  });
                },
              }
            : {})}
        />
      )}
    </ExportContext.Provider>
  );
}
