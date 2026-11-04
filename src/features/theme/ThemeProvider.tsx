import { useEffect, useLayoutEffect, type PropsWithChildren } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/constants';
import { useThemeStore } from '@/store/theme-store';

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useThemeStore((state) => state.theme);
  const syncSystemTheme = useThemeStore((state) => state.syncSystemTheme);
  const refreshPreference = useThemeStore((state) => state.refreshPreference);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor)
      themeColor.content = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg')
        .trim();
  }, [theme]);

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) =>
      syncSystemTheme(event.matches ? 'dark' : 'light');
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) refreshPreference();
    };

    syncSystemTheme(systemTheme.matches ? 'dark' : 'light');
    systemTheme.addEventListener('change', handleSystemChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      systemTheme.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [syncSystemTheme, refreshPreference]);

  return children;
}
