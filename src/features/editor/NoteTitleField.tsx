import { useRef, useState, type KeyboardEvent } from 'react';
import type { NoteDraft } from '@/features/editor/NoteDraft';
import { describeTitleChange } from '@/features/editor/title-hint';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface TitleEdit {
  /** What the field shows while it is being edited. */
  text: string;
  /** The name the note had when editing began; Escape returns to it. */
  original: string;
}

interface TitleOutcome {
  typed: string;
  saved: string;
}

/**
 * The note title input. While it is being edited it shows its own text and ignores the stored
 * title, so auto-save and rename results can never overwrite what the user is typing. The
 * stored title is shown again, with a hint if it differs from what was typed, once editing ends.
 */
export function NoteTitleField({ draft, disabled }: { draft: NoteDraft; disabled: boolean }) {
  const editTitle = useWorkspaceStore((state) => state.editNoteTitle);
  const commitTitle = useWorkspaceStore((state) => state.commitNoteTitle);
  const [edit, setEditState] = useState<TitleEdit | null>(null);
  const [outcome, setOutcome] = useState<TitleOutcome | null>(null);
  // Event handlers read the ref, so Enter followed by its own blur commits only once.
  const current = useRef<TitleEdit | null>(null);

  function setEdit(next: TitleEdit | null) {
    current.current = next;
    setEditState(next);
  }

  function beginning(): TitleEdit {
    return current.current ?? { text: draft.title, original: draft.note.title };
  }

  function finish() {
    const finished = current.current;
    if (!finished) return;
    setEdit(null);
    void commitTitle(draft.identifier, finished.text).then((result) => {
      if (result.ok) setOutcome({ typed: finished.text, saved: result.value });
    });
  }

  function cancel() {
    const cancelled = current.current;
    if (!cancelled) return;
    setEdit({ text: cancelled.original, original: cancelled.original });
    setOutcome(null);
    // Usually nothing was renamed yet. If the field was quiet long enough for a rename to have
    // happened, this renames back to the original name.
    void commitTitle(draft.identifier, cancelled.original);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter and Escape also operate input-method candidate windows (Sinhala, Tamil, ...).
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      finish();
      event.currentTarget.blur();
    } else if (event.key === 'Escape' && current.current) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  }

  const hint =
    !edit && outcome?.saved === draft.note.title
      ? describeTitleChange(outcome.typed, outcome.saved)
      : null;
  return (
    <>
      <input
        id="note-title"
        className="editor-title"
        value={edit ? edit.text : draft.title}
        placeholder="Untitled note"
        disabled={disabled}
        aria-invalid={draft.error?.code === 'invalid-name'}
        aria-describedby={hint ? 'note-title-hint' : undefined}
        onFocus={() => {
          setEdit(beginning());
          setOutcome(null);
        }}
        onChange={(event) => {
          const text = event.target.value;
          setEdit({ ...beginning(), text });
          setOutcome(null);
          editTitle(draft.identifier, text);
        }}
        onBlur={finish}
        onKeyDown={handleKeyDown}
      />
      <p id="note-title-hint" className="editor-title-hint" aria-live="polite">
        {hint}
      </p>
    </>
  );
}
