import { useState } from 'react';
import { TitleField } from '@/components/ui/TitleField';
import { success } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { DiagramSummary } from '@/types/notes';

/** Renames the diagram's file when the title is committed (Enter or leaving the field). */
export function DiagramTitleField({
  diagram,
  disabled,
}: {
  diagram: DiagramSummary;
  disabled: boolean;
}) {
  const renameDiagram = useWorkspaceStore((state) => state.renameDiagram);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <TitleField
        id="diagram-title"
        label="Diagram title"
        placeholder="Untitled diagram"
        title={diagram.title}
        savedTitle={diagram.title}
        disabled={disabled}
        invalid={error !== null}
        onType={() => setError(null)}
        onCommit={async (text) => {
          if (text === diagram.title) return success(text);
          const renamed = await renameDiagram(diagram.relativePath, text);
          setError(renamed.ok ? null : renamed.error.message);
          return renamed.ok ? success(renamed.value.title) : renamed;
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
