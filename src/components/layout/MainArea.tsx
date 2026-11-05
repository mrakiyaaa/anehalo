import type { RefObject } from 'react';
import { CaptureCard } from '@/features/editor/CaptureCard';
import { HomeGreeting } from '@/features/notes/HomeGreeting';
import { RecentNotes } from '@/features/notes/RecentNotes';
import { StorageStatus } from '@/features/storage/StorageStatus';
import { SettingsNotice } from '@/features/settings/SettingsNotice';

interface MainAreaProps {
  captureReference: RefObject<HTMLTextAreaElement | null>;
}

export function MainArea({ captureReference }: MainAreaProps) {
  return (
    <main aria-label="Workspace" className="home-panel">
      <StorageStatus />
      <SettingsNotice />
      <HomeGreeting />
      <CaptureCard captureReference={captureReference} />
      <RecentNotes />
    </main>
  );
}
