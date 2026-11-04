import { useWorkspaceStore } from '@/store/use-workspace-store';

export function StatusBar() {
  const tree = useWorkspaceStore((state) => state.tree);
  return (
    <footer className="app-statusbar">
      <span>
        {tree.notes.length} {tree.notes.length === 1 ? 'note' : 'notes'} · {tree.folders.length}{' '}
        {tree.folders.length === 1 ? 'folder' : 'folders'}
      </span>
      <span>Stored as .md files</span>
    </footer>
  );
}
