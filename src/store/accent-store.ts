import { create } from 'zustand';
import {
  applyAccent,
  defaultAccent,
  isAccentId,
  type AccentId,
} from '@/features/theme/accent-palette';
import {
  readLocalPreference,
  writeLocalPreference,
  type PreferenceStorage,
} from '@/lib/local-preference';

export const ACCENT_STORAGE_KEY = 'anehalo-accent';

interface AccentState {
  accent: AccentId;
  /** Shows the accent at once; settings.json is updated separately (see preference-sync). */
  setAccent: (accent: AccentId) => void;
}

export function createAccentStore(storage?: () => PreferenceStorage) {
  const saved = readLocalPreference(ACCENT_STORAGE_KEY, storage);
  return create<AccentState>((set) => ({
    accent: isAccentId(saved) ? saved : defaultAccent,
    setAccent: (accent) => {
      applyAccent(accent);
      writeLocalPreference(ACCENT_STORAGE_KEY, accent, storage);
      set({ accent });
    },
  }));
}

export const useAccentStore = createAccentStore();
