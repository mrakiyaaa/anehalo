import { createStore } from 'zustand/vanilla';
import { renamedLink, type LinkRename } from '@/features/note-links/NoteLinkRewriter';

export function createNavigationHistory() {
  return createStore<{
    paths: readonly string[];
    position: number;
    visit: (path: string) => void;
    move: (direction: -1 | 1) => string | null;
    rename: (rename: LinkRename) => void;
  }>()((set, get) => ({
    paths: [],
    position: -1,
    visit: (path) => {
      const { paths, position } = get();
      if (paths[position] === path) return;
      const next = [...paths.slice(0, position + 1), path].slice(-100);
      set({ paths: next, position: next.length - 1 });
    },
    move: (direction) => {
      const position = get().position + direction;
      const path = get().paths[position];
      if (path === undefined) return null;
      set({ position });
      return path;
    },
    rename: (rename) =>
      set({ paths: get().paths.map((path) => renamedLink(path, '', rename)?.path ?? path) }),
  }));
}
