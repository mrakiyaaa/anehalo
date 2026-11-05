import { useEffect, useState, type PropsWithChildren } from 'react';
import type { SettingsRepository } from '@/features/settings/SettingsRepository';
import { SettingsContext } from '@/features/settings/settings-context';
import { createSettingsStore } from '@/features/settings/settings-store';
import { useThemeStore } from '@/store/theme-store';

export function SettingsProvider({
  children,
  repository,
}: PropsWithChildren<{ repository: SettingsRepository }>) {
  const [store] = useState(() => createSettingsStore(repository));
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  useEffect(() => {
    let synchronized = false;
    let applyingSavedTheme = false;
    const unsubscribeSettings = store.subscribe((state) => {
      if (!state.settings || synchronized) return;
      synchronized = true;
      applyingSavedTheme = true;
      useThemeStore.getState().setPreference(state.settings.theme);
      applyingSavedTheme = false;
    });
    const unsubscribeTheme = useThemeStore.subscribe((state, previous) => {
      if (!applyingSavedTheme && state.preference !== previous.preference)
        void store.getState().updateTheme(state.preference ?? 'system');
    });
    return () => {
      unsubscribeSettings();
      unsubscribeTheme();
    };
  }, [store]);
  return <SettingsContext.Provider value={store}>{children}</SettingsContext.Provider>;
}
