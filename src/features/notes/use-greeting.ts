import { useCurrentTime } from '@/lib/use-current-time';

export function useGreeting() {
  const currentTime = useCurrentTime();

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const date = currentTime.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return { greeting, date };
}
