import { MotionConfig } from 'motion/react';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '@/features/theme/ThemeProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
