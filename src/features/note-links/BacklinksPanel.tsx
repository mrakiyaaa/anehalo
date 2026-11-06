import { FileText, Link2 } from 'lucide-react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';

export function BacklinksPanel({ path }: { path: string }) {
  const index = useWorkspaceStore((state) => state.links);
  const notes = useWorkspaceStore((state) => state.tree.notes);
  const openNote = useWorkspaceStore((state) => state.openNote);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const sources = index.backlinks.get(path) ?? [];
  const backlinks = notes.filter((note) => sources.includes(note.relativePath));
  return (
    <details className="backlinks-panel" open>
      <summary>
        <Link2 size={16} aria-hidden="true" />
        <span>Linked from</span>
        <span className="backlink-count">{backlinks.length}</span>
      </summary>
      {backlinks.length ? (
        <ul>
          {backlinks.map((note) => (
            <li key={note.relativePath}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  void openNote(note.relativePath);
                }}
              >
                <FileText size={15} aria-hidden="true" />
                <span>{note.title}</span>
                <span className={`note-picker-folder tone-${folderTone(note.folder)}`}>
                  {note.folder ? pathName(note.folder) : 'Vault root'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No links here yet. Use <kbd>/page</kbd> in another note to connect your thoughts.
        </p>
      )}
    </details>
  );
}
