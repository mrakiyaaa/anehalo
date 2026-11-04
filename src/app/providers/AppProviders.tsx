import { MotionConfig } from 'motion/react';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { WorkspaceProvider } from '@/features/storage/WorkspaceProvider';
import type { NoteRepository } from '@/features/storage/NoteRepository';

export function AppProviders({
  children,
  repository,
}: PropsWithChildren<{ repository: NoteRepository }>) {
  return (
    <ThemeProvider>
      <WorkspaceProvider repository={repository}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
