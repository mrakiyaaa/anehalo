import { Icon } from '@/components/ui/Icon';

export function WelcomeStep() {
  return (
    <div className="onboarding-chips tone-sky">
      {['Auto-save', 'Plain .md files', 'Light and dark'].map((label) => (
        <span key={label} className="onboarding-pill">
          <Icon name="check" />
          {label}
        </span>
      ))}
    </div>
  );
}
