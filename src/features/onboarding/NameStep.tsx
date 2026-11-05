import { useGreeting } from '@/features/notes/use-greeting';
import { maximumUserNameLength } from '@/features/settings/AppSettings';

export function NameStep({ name, setName }: { name: string; setName: (name: string) => void }) {
  const { greeting } = useGreeting();
  return (
    <div className="onboarding-stack">
      <div className="onboarding-field">
        <label htmlFor="onboarding-name">
          First name <span className="sr-only">(optional)</span>
        </label>
        <input
          id="onboarding-name"
          type="text"
          autoComplete="given-name"
          maxLength={maximumUserNameLength}
          placeholder="Your first name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="onboarding-hello tone-peach">
        <small>Home screen preview</small>
        <strong>
          {greeting}, {name.trim() || 'friend'}
        </strong>
      </div>
    </div>
  );
}
