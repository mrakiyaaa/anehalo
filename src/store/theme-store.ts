import { create } from 'zustand';
import {
  getSystemTheme,
  readThemePreference,
  saveThemePreference,
  type ThemeStorageProvider,
} from '@/features/theme/theme-preference';
import type { Theme } from '@/types/theme';

interface ThemeState {
  theme: Theme;
  preference: Theme | null;
  storageError: string | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  syncSystemTheme: (theme: Theme) => void;
  refreshPreference: () => void;
}

interface ThemeStoreOptions {
  getStorage?: ThemeStorageProvider;
  getSystemTheme?: () => Theme;
}

export function createThemeStore(options: ThemeStoreOptions = {}) {
  const getStorage = options.getStorage ?? (() => window.localStorage);
  const resolveSystemTheme = options.getSystemTheme ?? getSystemTheme;
  const initialPreference = readThemePreference(getStorage);

  return create<ThemeState>((set, get) => ({
    ...initialPreference,
    theme: initialPreference.preference ?? resolveSystemTheme(),
    setTheme: (theme) => {
      const storageError = saveThemePreference(theme, getStorage);
      set({ theme, preference: theme, storageError });
    },
    toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    syncSystemTheme: (theme) => {
      if (get().preference === null) set({ theme });
    },
    refreshPreference: () => {
      const savedPreference = readThemePreference(getStorage);
      set({ ...savedPreference, theme: savedPreference.preference ?? resolveSystemTheme() });
    },
  }));
}

export const useThemeStore = createThemeStore();
