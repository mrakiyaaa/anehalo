import { useContext } from 'react';
import { useStore } from 'zustand';
import { SettingsContext } from '@/features/settings/settings-context';
import type { SettingsStore } from '@/features/settings/settings-store';

export function useSettingsStore<Value>(
  selector: (state: ReturnType<SettingsStore['getState']>) => Value,
): Value {
  const store = useContext(SettingsContext);
  if (!store) throw new Error('Settings must be used inside SettingsProvider.');
  return useStore(store, selector);
}
