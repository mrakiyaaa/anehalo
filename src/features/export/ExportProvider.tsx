import { useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useAppServices } from '@/app/app-services';
import { SettingsContext } from '@/features/settings/settings-context';
import { WorkspaceContext } from '@/store/workspace-context';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { failure, type RepositoryResult } from '@/features/storage/repository-result';
import {
  DiagramExportService,
  type DiagramExportRequest,
} from '@/features/diagram-export/DiagramExportService';
import { diagramImageRenderer } from '@/features/thumbnails/thumbnail-renderer';
import { ExportService } from './ExportService';
import { ExportContext } from './export-context';
import { ExportToast } from './ExportToast';
import { LazyPdfExporter } from './PdfExporter';
import type { ExportAction, ExportOutcome, ExportProgress } from './export-types';

interface ExportNotice {
  readonly message: string;
  readonly error?: boolean;
  readonly path?: string;
}

const noDiagram = failure({
  code: 'unavailable',
  message: 'Open a diagram to export it.',
} as const);

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
  const platform = useMemo(
    () => services.createExportPlatform(settings.getState().settings?.vaultPath ?? ''),
    [services, settings],
  );
  const exportSettings = useMemo(
    () => ({
      lastFolder: () => settings.getState().settings?.lastExportFolder ?? null,
      rememberFolder: (folder: string) => settings.getState().updateLastExportFolder(folder),
    }),
    [settings],
  );
  const service = useMemo(
    () =>
      new ExportService(
        repository,
        platform,
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
        exportSettings,
        (path) => workspace.getState().renderDiagramImage(path),
      ),
    [repository, platform, workspace, readers, exportSettings],
  );
  const diagramService = useMemo(
    () =>
      new DiagramExportService({
        platform,
        renderer: () => Promise.resolve(diagramImageRenderer),
        // Excalidraw's serializer, loaded only when a copy is saved.
        serializeScene: async (scene) =>
          (await import('@/features/diagrams/diagram-codec')).serializeDiagram(scene),
        settings: exportSettings,
      }),
    [platform, exportSettings],
  );
  const value = useMemo(() => {
    /** One export at a time, with its notice; `work` reports progress and returns the outcome. */
    async function perform(
      path: string,
      work: (
        report: (message: string, fraction: number | null) => void,
      ) => Promise<RepositoryResult<ExportOutcome>>,
    ) {
      if (busy.current)
        return failure({ code: 'unavailable', message: 'Another export is still in progress.' });
      busy.current = true;
      setNotice(null);
      try {
        const result = await work((message, fraction) => setProgress({ path, message, fraction }));
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
    }
    /** What was chosen is offered again next time, whether or not the export succeeds. */
    const rememberOptions = ({ options }: DiagramExportRequest) => {
      const saved = settings.getState().settings?.diagramExport;
      if (saved && JSON.stringify(saved) === JSON.stringify(options)) return;
      void settings.getState().update({ diagramExport: options });
    };
    return {
      progress,
      registerEditor: (path: string, read: () => string) => {
        readers.set(path, read);
        return () => {
          if (readers.get(path) === read) readers.delete(path);
        };
      },
      run: (path: string, action: ExportAction) =>
        perform(path, (report) => service.execute(path, action, report)),
      runDiagram: async (request: DiagramExportRequest) => {
        const diagram = workspace.getState().diagram;
        if (!diagram) return perform('', () => Promise.resolve(noDiagram));
        // A copy for sharing has no image options, so it keeps the ones remembered.
        if (!busy.current && request.action !== 'save-copy') rememberOptions(request);
        return perform(diagram.summary.relativePath, (report) =>
          diagramService.execute(
            { title: diagram.summary.title, scene: diagram.scene },
            request,
            (message) => report(message, null),
          ),
        );
      },
    };
  }, [progress, service, diagramService, readers, workspace, settings]);
  const revealPath = notice?.path;
  return (
    <ExportContext.Provider value={value}>
      {children}
      {progress && (
        <div className="export-progress" role="status">
          <span>{progress.message}</span>
          <progress
            max={1}
            aria-label="Export progress"
            {...(progress.fraction === null ? {} : { value: progress.fraction })}
          />
        </div>
      )}
      {notice && (
        <ExportToast
          message={notice.message}
          {...(notice.error ? { error: true } : {})}
          onDismiss={() => setNotice(null)}
          {...(revealPath
            ? {
                onReveal: () => {
                  void service.reveal(revealPath).then((result) => {
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
