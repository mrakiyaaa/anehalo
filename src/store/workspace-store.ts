import { create } from 'zustand';

interface WorkspaceState {
  activeFolderId: string | null;
  searchText: string;
  selectFolder: (folderId: string | null) => void;
  setSearchText: (searchText: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeFolderId: null,
  searchText: '',
  selectFolder: (activeFolderId) => set({ activeFolderId }),
  setSearchText: (searchText) => set({ searchText }),
}));
