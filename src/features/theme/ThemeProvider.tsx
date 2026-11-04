import { useEffect, type PropsWithChildren } from 'react';
import { useThemeStore } from '@/store/theme-store';

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return children;
}
