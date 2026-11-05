import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';

const tips: { tone: string; icon: IconName; title: string; body: ReactNode }[] = [
  {
    tone: 'sky',
    icon: 'check',
    title: 'Auto-save',
    body: 'Just type. Every change is saved as you go.',
  },
  {
    tone: 'lilac',
    icon: 'link',
    title: 'Link notes',
    body: (
      <>
        Type <kbd>/page</kbd> and pick a note to link.
      </>
    ),
  },
  {
    tone: 'mint',
    icon: 'export',
    title: 'Export',
    body: 'Copy or download any note as .md or PDF.',
  },
  {
    tone: 'peach',
    icon: 'bolt',
    title: 'Quick note',
    body: (
      <>
        Press <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>N</kbd> from anywhere.
      </>
    ),
  },
];

export function TipsStep() {
  return (
    <div className="onboarding-tips">
      {tips.map((tip) => (
        <div key={tip.title} className={`onboarding-tip tone-${tip.tone}`}>
          <span className="onboarding-tip-icon">
            <Icon name={tip.icon} />
          </span>
          <h3>{tip.title}</h3>
          <p>{tip.body}</p>
        </div>
      ))}
    </div>
  );
}
