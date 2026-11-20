import { create } from 'zustand';
import {
  readLocalPreference,
  writeLocalPreference,
  type PreferenceStorage,
} from '@/lib/local-preference';

export const SIDEBAR_STORAGE_KEY = 'anehalo-sidebar-collapsed';
/** Below this window width the sidebar collapses on its own; see shouldCollapse. */
export const NARROW_WINDOW_WIDTH = 900;

interface SidebarState {
  /** What the user chose; saved to settings.json. */
  collapsedPreference: boolean;
  /** Whether the window is too narrow for the full sidebar. Never saved. */
  isNarrowWindow: boolean;
  /** False when the change restores a saved state, which must not animate. */
  animate: boolean;
  toggle: () => void;
  restore: (collapsed: boolean) => void;
  setNarrowWindow: (isNarrowWindow: boolean) => void;
}

/** A narrow window collapses the sidebar without changing the saved preference. */
export function shouldCollapse(
  state: Pick<SidebarState, 'collapsedPreference' | 'isNarrowWindow'>,
) {
  return state.collapsedPreference || state.isNarrowWindow;
}

export function createSidebarStore(storage?: () => PreferenceStorage) {
  return create<SidebarState>((set, get) => ({
    collapsedPreference: readLocalPreference(SIDEBAR_STORAGE_KEY, storage) === 'true',
    isNarrowWindow: false,
    animate: false,
    toggle: () => {
      // In a narrow window the sidebar shows collapsed whatever the preference, so the button
      // and shortcut expand it by clearing the preference and leaving narrow mode for now.
      const collapsed = !shouldCollapse(get());
      writeLocalPreference(SIDEBAR_STORAGE_KEY, String(collapsed), storage);
      set({ collapsedPreference: collapsed, isNarrowWindow: false, animate: true });
    },
    restore: (collapsed) => {
      writeLocalPreference(SIDEBAR_STORAGE_KEY, String(collapsed), storage);
      set({ collapsedPreference: collapsed, animate: false });
    },
    setNarrowWindow: (isNarrowWindow) => set({ isNarrowWindow, animate: true }),
  }));
}

export const useSidebarStore = createSidebarStore();
