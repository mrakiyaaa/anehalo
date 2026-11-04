import { useGreeting } from '@/features/notes/use-greeting';
import { mockWorkspace } from '@/lib/mock-data';

export function HomeGreeting() {
  const { greeting, date } = useGreeting();

  return (
    <div className="home-greeting">
      <h1>
        {greeting}, {mockWorkspace.displayName}
      </h1>
      <p>{date}</p>
    </div>
  );
}
