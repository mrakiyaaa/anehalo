import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { SlashQuery } from '@/features/editor/commands/slash-commands';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { NotePicker, type PickerItem } from './NotePicker';
import { afterTrackingRange, type InsertionRange } from './track-selection';

/**
 * `/diagram`: embeds an existing diagram, or creates a new one in the note's folder and embeds
 * it. The note stays open; the new diagram is not.
 */
export function DiagramEmbedPicker({
  editor,
  range,
  onDismiss,
}: {
  editor: Editor;
  range?: SlashQuery;
  onDismiss: () => void;
}) {
  const diagrams = useWorkspaceStore((state) => state.tree.diagrams);
  const folder = useWorkspaceStore((state) => state.openDraft?.note.folder ?? null);
  const createDiagramFile = useWorkspaceStore((state) => state.createDiagramFile);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = range ? range.query.replace(/^diagram\s*/i, '') : search;

  function embed(item: PickerItem, selection: InsertionRange = range ?? editor.state.selection) {
    if (editor.isDestroyed) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: selection.from, to: selection.to },
        { type: 'diagramEmbed', attrs: { path: item.relativePath, title: item.title } },
      )
      .run();
    onDismiss();
  }

  async function createAndEmbed() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { value: created, range: selection } = await afterTrackingRange(
      editor,
      {
        from: range?.from ?? editor.state.selection.from,
        to: range?.to ?? editor.state.selection.to,
      },
      () => createDiagramFile(folder),
    );
    setBusy(false);
    if (!created.ok) {
      setError(created.error.message);
      return;
    }
    embed(created.value, selection);
  }

  return (
    <>
      <NotePicker
        notes={diagrams}
        query={query}
        heading="Embed a diagram"
        alwaysCreate="New diagram"
        onChoose={embed}
        onCreate={() => {
          void createAndEmbed();
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
