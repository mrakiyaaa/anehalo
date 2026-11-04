import { THEME_STORAGE_KEY } from '@/lib/constants';
import type { Theme } from '@/types/theme';

export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ThemeStorageProvider = () => ThemeStorage;

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readThemePreference(getStorage: ThemeStorageProvider): {
  preference: Theme | null;
  storageError: string | null;
} {
  try {
    const savedTheme = getStorage().getItem(THEME_STORAGE_KEY);
    const preference = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : null;
    return { preference, storageError: null };
  } catch {
    return {
      preference: null,
      storageError: 'Your theme preference could not be read. Using your system theme.',
    };
  }
}

export function saveThemePreference(theme: Theme, getStorage: ThemeStorageProvider) {
  try {
    getStorage().setItem(THEME_STORAGE_KEY, theme);
    return null;
  } catch {
    return 'Your theme changed for this session, but the preference could not be saved.';
  }
}
