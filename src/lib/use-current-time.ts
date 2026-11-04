import { useEffect, useState } from 'react';

export function useCurrentTime(): Date {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);
  return currentTime;
}
