import { create } from 'zustand';

export const homeFilters = ['all', 'notes', 'diagrams'] as const;
export type HomeFilter = (typeof homeFilters)[number];

export function isHomeFilter(value: unknown): value is HomeFilter {
  return typeof value === 'string' && (homeFilters as readonly string[]).includes(value);
}

/** Which kinds of items Home lists; saved to settings.json by preference-sync. */
export const useHomeFilterStore = create<{
  filter: HomeFilter;
  setFilter: (filter: HomeFilter) => void;
}>((set) => ({ filter: 'all', setFilter: (filter) => set({ filter }) }));
