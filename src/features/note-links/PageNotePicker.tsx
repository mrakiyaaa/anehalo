import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { SlashQuery } from '@/features/editor/commands/slash-commands';
import { vaultItems } from '@/features/storage/vault-items';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { NotePicker, type PickerItem } from './NotePicker';
import { afterTrackingRange, type InsertionRange } from './track-selection';

/** `/page`: links a note or a diagram; typing a new title creates a note. */
export function PageNotePicker({
  editor,
  range,
  onDismiss,
}: {
  editor: Editor;
  range?: SlashQuery;
  onDismiss: () => void;
}) {
  const tree = useWorkspaceStore((state) => state.tree);
  const folder = useWorkspaceStore((state) => state.openDraft?.note.folder ?? null);
  const createNote = useWorkspaceStore((state) => state.createLinkedNote);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = range ? range.query.replace(/^page\s*/i, '') : search;
  function insert(item: PickerItem, selection: InsertionRange = range ?? editor.state.selection) {
    if (editor.isDestroyed) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: selection.from, to: selection.to },
        { type: 'noteLink', attrs: { path: item.relativePath, label: item.title } },
      )
      .run();
    onDismiss();
  }
  async function create(title: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { value: result, range: selection } = await afterTrackingRange(
      editor,
      {
        from: range?.from ?? editor.state.selection.from,
        to: range?.to ?? editor.state.selection.to,
      },
      () => createNote(title, folder),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    insert(result.value, selection);
  }
  return (
    <>
      <NotePicker
        notes={vaultItems(tree)}
        query={query}
        onChoose={insert}
        onCreate={(title) => {
          void create(title);
        }}
        onDismiss={onDismiss}
        {...(range ? { keyboardTarget: editor.view.dom } : { onQueryChange: setSearch })}
        busy={busy}
      />
      {error && (
        <p role="alert" className="note-picker-error">
          {error}
        </p>
      )}
    </>
  );
}
