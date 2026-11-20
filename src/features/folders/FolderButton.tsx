import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/IconBadge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { PastelTone } from '@/types/notes';
import { countLabel } from '@/features/storage/vault-counts';

interface FolderButtonProps {
  name: string;
  tone: PastelTone | 'all';
  count: number;
  active: boolean;
  onSelect: () => void;
  /** The collapsed sidebar shows only the coloured badge, with the name as a tooltip. */
  iconOnly?: boolean;
}

export function FolderButton({
  name,
  tone,
  count,
  active,
  onSelect,
  iconOnly = false,
}: FolderButtonProps) {
  const button = (
    <Button
      variant="ghost"
      className={iconOnly ? 'folder-button rail-folder' : 'folder-button'}
      aria-pressed={active}
      aria-label={`${name}, ${countLabel(count, 'item', 'items')}`}
      onClick={onSelect}
    >
      <IconBadge icon={tone === 'all' ? 'all-notes' : 'folder'} tone={tone} />
      {!iconOnly && (
        <>
          <span className="folder-name">{name}</span>{' '}
          <span className="folder-count" aria-hidden="true">
            {count}
          </span>
        </>
      )}
    </Button>
  );
  return iconOnly ? (
    <Tooltip label={name} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
