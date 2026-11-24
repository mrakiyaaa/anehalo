import * as Popover from '@radix-ui/react-popover';
import { useNoteExport } from '@/features/export/export-context';
import { ExportButton } from '@/features/export/ExportButton';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { defaultDiagramExportOptions } from './diagram-export-options';
import { DiagramExportForm, type DiagramExportChoice } from './DiagramExportForm';

interface DiagramExportButtonProps {
  readonly path: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The element ids selected when the popover opened. */
  readonly selection: readonly string[];
}

/** The diagram header's Export button; its popover is the only way to export a diagram. */
export function DiagramExportButton({
  path,
  open,
  onOpenChange,
  selection,
}: DiagramExportButtonProps) {
  const { runDiagram, progress } = useNoteExport();
  const remembered = useSettingsStore((state) => state.settings?.diagramExport);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const exporting = progress?.path === path;
  const run = (choice: DiagramExportChoice) => {
    onOpenChange(false);
    void runDiagram({
      action: choice.action,
      options: choice.options,
      selection: choice.selectionOnly ? selection : null,
    });
  };
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <ExportButton
          subject="diagram"
          progress={exporting ? (progress.fraction ?? 0) : null}
          disabled={disabled || progress !== null}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="diagram-export-popover accent-popover"
          align="end"
          sideOffset={8}
        >
          <DiagramExportForm
            initialOptions={remembered ?? defaultDiagramExportOptions}
            selectedCount={selection.length}
            busy={progress !== null}
            onRun={run}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
