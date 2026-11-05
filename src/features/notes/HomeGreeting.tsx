import { useGreeting } from '@/features/notes/use-greeting';
import { useSettingsStore } from '@/features/settings/use-settings-store';

export function HomeGreeting() {
  const { greeting, date } = useGreeting();
  const userName = useSettingsStore((state) => state.settings?.userName ?? '');

  return (
    <div className="home-greeting">
      <h1>
        {greeting}
        {userName ? `, ${userName}` : ''}
      </h1>
      <p>{date}</p>
    </div>
  );
}
