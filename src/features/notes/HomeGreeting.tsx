import { useGreeting } from '@/features/notes/use-greeting';

export function HomeGreeting() {
  const { greeting, date } = useGreeting();

  return (
    <div className="home-greeting">
      <h1>{greeting}</h1>
      <p>{date}</p>
    </div>
  );
}
