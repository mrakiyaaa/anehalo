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
  setPreference: (preference: Theme | 'system') => void;
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
    setPreference: (preference) => {
      const storageError = saveThemePreference(preference, getStorage);
      set({
        theme: preference === 'system' ? resolveSystemTheme() : preference,
        preference: preference === 'system' ? null : preference,
        storageError,
      });
    },
    setTheme: (theme) => get().setPreference(theme),
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
