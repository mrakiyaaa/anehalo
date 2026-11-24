import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { useMemo, useState } from 'react';
import { ExportButton } from './ExportButton';
import { useExportKeys } from './use-export-keys';
import { useNoteExport } from './export-context';
import { useWorkspaceStore } from '@/store/use-workspace-store';

import { exportActions } from './export-actions';

export function ExportMenuItems({
  path,
  variant,
}: {
  path: string;
  variant: 'context' | 'dropdown';
}) {
  const { run, progress } = useNoteExport();
  const Item = variant === 'context' ? ContextMenu.Item : DropdownMenu.Item;
  return (
    <>
      {exportActions.map((option) => (
        <Item
          key={option.action}
          className="item-menu-option export-menu-option"
          disabled={progress !== null}
          onSelect={() => {
            void run(path, option.action);
          }}
        >
          <option.icon size={15} aria-hidden="true" />
          <span>{option.label}</span>
          {'shortcut' in option && <kbd>{option.shortcut}</kbd>}
        </Item>
      ))}
    </>
  );
}
export function ExportMenu({ path }: { path: string }) {
  const { run, progress } = useNoteExport();
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const [open, setOpen] = useState(false);
  const keys = useMemo(
    () => ({
      e: () => {
        if (!disabled && !progress) setOpen(true);
      },
      c: () => {
        if (!disabled && !progress) void run(path, 'copy-markdown');
      },
    }),
    [path, run, progress, disabled],
  );
  useExportKeys(keys);
  const exporting = progress?.path === path;
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <ExportButton
          subject="note"
          progress={exporting ? (progress.fraction ?? 0) : null}
          disabled={disabled || progress !== null}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="item-menu-content export-menu" sideOffset={8} align="end">
          <ExportMenuItems path={path} variant="dropdown" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
