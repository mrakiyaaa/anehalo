import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Download, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey ||
        event.altKey ||
        !['c', 'e'].includes(event.key.toLowerCase())
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (disabled || progress) return;
      if (event.key.toLowerCase() === 'e') setOpen(true);
      else void run(path, 'copy-markdown');
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [path, run, progress, disabled]);
  const exporting = progress?.path === path;
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className="editor-export-button"
        disabled={disabled || progress !== null}
        aria-label={exporting ? 'Exporting note' : 'Export'}
      >
        {exporting ? (
          <LoaderCircle className="export-spinner" size={15} aria-hidden="true" />
        ) : (
          <Download size={15} aria-hidden="true" />
        )}
        <span>{exporting ? `${Math.round(progress.fraction * 100)}%` : 'Export'}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="item-menu-content export-menu" sideOffset={8} align="end">
          <ExportMenuItems path={path} variant="dropdown" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
