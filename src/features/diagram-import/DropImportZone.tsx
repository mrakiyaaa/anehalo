import { FileUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { pathName } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useDiagramImport } from './import-context';
import { importFileKind } from './import-file-kind';

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * Takes files dropped on the window. On Home every dropped file is imported, into the selected
 * folder or the vault root. Over a note or a diagram the editor owns drops (images are inserted),
 * so only .excalidraw files are taken, which would otherwise replace the open drawing.
 */
export function DropImportZone() {
  const importer = useDiagramImport();
  const view = useWorkspaceStore((state) => state.view);
  const folder = useWorkspaceStore((state) => state.activeFolderPath);
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave also fire for every child element passed over.
  const depth = useRef(0);
  const latest = useRef({ importer, view, folder });
  useEffect(() => {
    latest.current = { importer, view, folder };
  }, [importer, view, folder]);
  useEffect(() => {
    const reset = () => {
      depth.current = 0;
      setDragging(false);
    };
    const onDragEnter = (event: DragEvent) => {
      if (latest.current.view !== 'home' || !carriesFiles(event)) return;
      depth.current += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (latest.current.view !== 'home' || !carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: DragEvent) => {
      if (latest.current.view !== 'home' || !carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      reset();
      const { importer: controls, view: currentView, folder: target } = latest.current;
      if (!controls || !event.dataTransfer) return;
      const files = Array.from(event.dataTransfer.files);
      const taken =
        currentView === 'home'
          ? files
          : files.filter((file) => importFileKind(file.name) === 'excalidraw');
      if (taken.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void controls.importFiles(taken, target);
    };
    window.addEventListener('dragenter', onDragEnter, true);
    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('dragleave', onDragLeave, true);
    window.addEventListener('drop', onDrop, true);
    window.addEventListener('dragend', reset, true);
    return () => {
      window.removeEventListener('dragenter', onDragEnter, true);
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('dragleave', onDragLeave, true);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('dragend', reset, true);
    };
  }, []);
  if (!dragging || view !== 'home') return null;
  return (
    <div className="drop-import-overlay" role="status" aria-live="polite">
      <div className="drop-import-card">
        <FileUp size={28} aria-hidden="true" />
        <strong>Drop to import diagrams</strong>
        <span>
          Excalidraw files, and PNG or SVG images with an embedded drawing, go into{' '}
          {folder ? pathName(folder) : 'the vault root'}.
        </span>
      </div>
    </div>
  );
}
