import { useRef, useState, type KeyboardEvent } from 'react';
import { describeTitleChange } from '@/features/editor/title-hint';
import type { RepositoryResult } from '@/features/storage/repository-result';

interface TitleEdit {
  /** What the field shows while it is being edited. */
  text: string;
  /** The name the item had when editing began; Escape returns to it. */
  original: string;
}

interface TitleOutcome {
  typed: string;
  saved: string;
}

interface TitleFieldProps {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  /** The title to show while the field is not being edited. */
  readonly title: string;
  /** The item's current name on disk. */
  readonly savedTitle: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  /** Called on every keystroke, before the rename is committed. */
  readonly onType?: (text: string) => void;
  /** Renames for the typed title. Resolves to the title the item ended up with. */
  readonly onCommit: (text: string) => Promise<RepositoryResult<string>>;
}

/**
 * The title input of a note or diagram. While it is being edited it shows its own text and
 * ignores the stored title, so auto-save and rename results can never overwrite what the user
 * is typing. The stored title is shown again, with a hint if it differs from what was typed,
 * once editing ends.
 */
export function TitleField({
  id,
  label,
  placeholder,
  title,
  savedTitle,
  disabled,
  invalid,
  onType,
  onCommit,
}: TitleFieldProps) {
  const [edit, setEditState] = useState<TitleEdit | null>(null);
  const [outcome, setOutcome] = useState<TitleOutcome | null>(null);
  // Event handlers read the ref, so Enter followed by its own blur commits only once.
  const current = useRef<TitleEdit | null>(null);

  function setEdit(next: TitleEdit | null) {
    current.current = next;
    setEditState(next);
  }

  function beginning(): TitleEdit {
    return current.current ?? { text: title, original: savedTitle };
  }

  function finish() {
    const finished = current.current;
    if (!finished) return;
    setEdit(null);
    void onCommit(finished.text).then((result) => {
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
    void onCommit(cancelled.original);
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

  const hintId = `${id}-hint`;
  const hint =
    !edit && outcome?.saved === savedTitle
      ? describeTitleChange(outcome.typed, outcome.saved)
      : null;
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className="editor-title"
        value={edit ? edit.text : title}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={hint ? hintId : undefined}
        onFocus={() => {
          setEdit(beginning());
          setOutcome(null);
        }}
        onChange={(event) => {
          const text = event.target.value;
          setEdit({ ...beginning(), text });
          setOutcome(null);
          onType?.(text);
        }}
        onBlur={finish}
        onKeyDown={handleKeyDown}
      />
      <p id={hintId} className="editor-title-hint" aria-live="polite">
        {hint}
      </p>
    </>
  );
}
