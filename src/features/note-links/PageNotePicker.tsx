import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import type { NoteSummary } from '@/types/notes';
import type { SlashQuery } from '@/features/editor/commands/slash-commands';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { NotePicker } from './NotePicker';

export function PageNotePicker({
  editor,
  range,
  onDismiss,
}: {
  editor: Editor;
  range?: SlashQuery;
  onDismiss: () => void;
}) {
  const notes = useWorkspaceStore((state) => state.tree.notes);
  const folder = useWorkspaceStore((state) => state.openDraft?.note.folder ?? null);
  const createNote = useWorkspaceStore((state) => state.createLinkedNote);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = range ? range.query.replace(/^page\s*/i, '') : search;
  function insert(
    note: NoteSummary,
    selection: { from: number; to: number } = range ?? editor.state.selection,
  ) {
    if (editor.isDestroyed) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: selection.from, to: selection.to },
        {
          type: 'noteLink',
          attrs: { path: note.relativePath, label: note.title },
        },
      )
      .run();
    onDismiss();
  }
  async function create(title: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let selection = {
      from: range?.from ?? editor.state.selection.from,
      to: range?.to ?? editor.state.selection.to,
    };
    const mapSelection = ({ transaction }: { transaction: Transaction }) => {
      selection = {
        from: transaction.mapping.map(selection.from),
        to: transaction.mapping.map(selection.to),
      };
    };
    editor.on('transaction', mapSelection);
    const result = await createNote(title, folder);
    editor.off('transaction', mapSelection);
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
        notes={notes}
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
