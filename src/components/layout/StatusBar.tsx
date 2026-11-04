import { mockFolders, mockNotes } from '@/lib/mock-data';

export function StatusBar() {
  return (
    <footer className="app-statusbar">
      <span>
        {mockNotes.length} notes · {mockFolders.length} folders
      </span>
      <span>Stored as .md files</span>
    </footer>
  );
}
