import type { PropsWithChildren } from 'react';
import { mergeClassNames } from '@/lib/utils';

interface ChoiceCardProps {
  group: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
  hideMark?: boolean;
}

export function ChoiceCard({
  children,
  group,
  value,
  checked,
  onChange,
  className = '',
  hideMark = false,
}: PropsWithChildren<ChoiceCardProps>) {
  return (
    <label className={mergeClassNames('onboarding-choice', className, checked && 'is-on')}>
      <input type="radio" name={group} value={value} checked={checked} onChange={onChange} />
      {!hideMark && <span className="onboarding-mark" aria-hidden="true" />}
      {children}
    </label>
  );
}
