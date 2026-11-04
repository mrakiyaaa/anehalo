import { Icon, type IconName } from '@/components/ui/Icon';
import { mergeClassNames } from '@/lib/utils';
import type { PastelTone } from '@/types/notes';

interface IconBadgeProps {
  icon: IconName;
  tone?: PastelTone | 'all';
  className?: string;
}

export function IconBadge({ icon, tone, className }: IconBadgeProps) {
  return (
    <span className={mergeClassNames('icon-badge', tone && `tone-${tone}`, className)}>
      <Icon name={icon} />
    </span>
  );
}
