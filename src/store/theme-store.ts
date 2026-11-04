import { create } from 'zustand';
import { DEFAULT_THEME } from '@/lib/constants';
import type { Theme } from '@/types/theme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => set({ theme }),
}));
