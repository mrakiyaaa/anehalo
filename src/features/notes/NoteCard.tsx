import { ItemMenu } from '@/components/ui/ItemMenu';
import { pathName } from '@/features/storage/storage-paths';
import { folderTone } from '@/lib/folder-tone';
import { formatRelativeTime } from '@/lib/relative-time';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { NoteSummary } from '@/types/notes';

interface NoteCardProps {
  note: NoteSummary;
  currentTime: number;
}

export function NoteCard({ note, currentTime }: NoteCardProps) {
  const renameNote = useWorkspaceStore((state) => state.renameNote);
  const deleteNote = useWorkspaceStore((state) => state.deleteNote);
  const openNote = useWorkspaceStore((state) => state.openNote);
  return (
    <ItemMenu
      kind="note"
      name={note.title}
      onRename={(name) => renameNote(note.relativePath, name)}
      onDelete={() => deleteNote(note.relativePath)}
    >
      <article className={`note-card tone-${folderTone(note.folder)}`} title={note.relativePath}>
        <button
          type="button"
          className="note-card-open"
          aria-label={`Open ${note.title}`}
          onClick={() => {
            void openNote(note.relativePath);
          }}
        />
        <h3>{note.title}</h3>
        <p>{note.snippet || 'An empty note, ready for a thought.'}</p>
        <div className="note-card-footer">
          <span className="folder-chip" title={note.folder ?? 'Vault root'}>
            {note.folder ? pathName(note.folder) : 'Vault root'}
          </span>
          <span className="note-edited-time">
            {formatRelativeTime(note.modifiedAt, currentTime)}
          </span>
        </div>
      </article>
    </ItemMenu>
  );
}
