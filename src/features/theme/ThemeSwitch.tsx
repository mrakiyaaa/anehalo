import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { transitionTheme } from '@/features/theme/transition-theme';
import { useThemeStore } from '@/store/theme-store';

export function ThemeSwitch() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const storageError = useThemeStore((state) => state.storageError);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const isDark = theme === 'dark';

  async function changeTheme(button: HTMLButtonElement) {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTransitionError(null);
    const bounds = button.getBoundingClientRect();
    try {
      await transitionTheme(
        { horizontal: bounds.left + bounds.width / 2, vertical: bounds.top + bounds.height / 2 },
        () => flushSync(toggleTheme),
      );
    } catch {
      setTransitionError('Your theme could not be changed. Please try again.');
    } finally {
      setIsTransitioning(false);
    }
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-label="Dark mode"
        aria-checked={isDark}
        aria-busy={isTransitioning}
        className="theme-switch"
        onClick={(event) => {
          void changeTheme(event.currentTarget);
        }}
      >
        <motion.span
          className="theme-knob"
          initial={false}
          animate={{ x: isDark ? 26 : 0 }}
          transition={
            reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 26 }
          }
        >
          <motion.span
            className="theme-symbol theme-sun"
            initial={false}
            animate={{ rotate: isDark ? 70 : 0, scale: isDark ? 0.6 : 1, opacity: isDark ? 0 : 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
          >
            <Icon name="sun" />
          </motion.span>
          <motion.span
            className="theme-symbol theme-moon"
            initial={false}
            animate={{ rotate: isDark ? 0 : -70, scale: isDark ? 1 : 0.6, opacity: isDark ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
          >
            <Icon name="moon" />
          </motion.span>
        </motion.span>
      </button>
      {(storageError || transitionError) && (
        <span className="titlebar-notice" role="status">
          {storageError ?? transitionError}
        </span>
      )}
    </>
  );
}
