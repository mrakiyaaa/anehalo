import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '@/components/ui/Icon';
import { useAnimatedThemeToggle } from '@/features/theme/use-animated-theme-toggle';
import { useThemeStore } from '@/store/theme-store';

export function ThemeSwitch() {
  const theme = useThemeStore((state) => state.theme);
  const storageError = useThemeStore((state) => state.storageError);
  const { isTransitioning, transitionError, toggleFrom } = useAnimatedThemeToggle();
  const reducedMotion = useReducedMotion();
  const isDark = theme === 'dark';

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
          void toggleFrom(event.currentTarget);
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
