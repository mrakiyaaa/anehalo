import { useState } from 'react';
import { flushSync } from 'react-dom';
import { transitionTheme } from '@/features/theme/transition-theme';
import { useThemeStore } from '@/store/theme-store';

export function centerOf(element: Element) {
  const bounds = element.getBoundingClientRect();
  return { horizontal: bounds.left + bounds.width / 2, vertical: bounds.top + bounds.height / 2 };
}

/** Switches light/dark with the circular reveal, starting from where the user clicked. */
export function useAnimatedThemeToggle() {
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  async function toggleFrom(element: Element) {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTransitionError(null);
    try {
      // flushSync commits the new theme inside the transition, so its snapshot shows it.
      await transitionTheme(centerOf(element), () => flushSync(toggleTheme));
    } catch {
      setTransitionError('Your theme could not be changed. Please try again.');
    } finally {
      setIsTransitioning(false);
    }
  }

  return { isTransitioning, transitionError, toggleFrom };
}
