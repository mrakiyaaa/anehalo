import { CaptureCard } from '@/features/editor/CaptureCard';
import { HomeGreeting } from '@/features/notes/HomeGreeting';
import { RecentNotes } from '@/features/notes/RecentNotes';
import { StorageStatus } from '@/features/storage/StorageStatus';
import { SettingsNotice } from '@/features/settings/SettingsNotice';

export function MainArea() {
  return (
    <main aria-label="Workspace" className="home-panel">
      <StorageStatus />
      <SettingsNotice />
      <HomeGreeting />
      <CaptureCard />
      <RecentNotes />
    </main>
  );
}
