import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/IconBadge';
import type { PastelTone } from '@/types/notes';

interface FolderButtonProps {
  name: string;
  tone: PastelTone | 'all';
  count: number;
  active: boolean;
  onSelect: () => void;
}

export function FolderButton({ name, tone, count, active, onSelect }: FolderButtonProps) {
  return (
    <Button
      variant="ghost"
      className="folder-button"
      aria-pressed={active}
      aria-label={`${name}, ${count} ${count === 1 ? 'note' : 'notes'}`}
      onClick={onSelect}
    >
      <IconBadge icon={tone === 'all' ? 'all-notes' : 'folder'} tone={tone} />
      <span className="folder-name">{name}</span>
      <span className="folder-count">{count}</span>
    </Button>
  );
}
