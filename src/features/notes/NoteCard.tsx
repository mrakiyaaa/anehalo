import { Icon } from '@/components/ui/Icon';
import type { Folder, Note } from '@/types/notes';

interface NoteCardProps {
  note: Note;
  folder: Folder;
}

export function NoteCard({ note, folder }: NoteCardProps) {
  return (
    <article className={`note-card tone-${folder.tone}`}>
      <h3>{note.title}</h3>
      <p>{note.text}</p>
      {note.linkedNoteTitle && (
        <div className="note-link">
          <Icon name="link" />
          <span>{note.linkedNoteTitle}</span>
        </div>
      )}
      <div className="note-card-footer">
        <span className="folder-chip">{folder.name}</span>
        <span className="note-edited-time">{note.editedLabel}</span>
      </div>
    </article>
  );
}
