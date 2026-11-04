import { Icon } from '@/components/ui/Icon';
import { useWorkspaceStore } from '@/store/workspace-store';

export function NoteSearch() {
  const searchText = useWorkspaceStore((state) => state.searchText);
  const setSearchText = useWorkspaceStore((state) => state.setSearchText);

  return (
    <div className="note-search">
      <Icon name="search" />
      <label className="sr-only" htmlFor="note-search">
        Search notes
      </label>
      <input
        id="note-search"
        type="search"
        placeholder="Search notes"
        autoComplete="off"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
      />
    </div>
  );
}
