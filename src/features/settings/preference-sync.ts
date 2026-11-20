import { useEffect } from 'react';
import { create } from 'zustand';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { AppSettings } from '@/features/settings/AppSettings';
import type { SettingsStore } from '@/features/settings/settings-store';
import { useAccentStore } from '@/store/accent-store';
import { useSidebarStore } from '@/store/sidebar-store';
import { useHomeFilterStore } from '@/store/home-filter-store';
import { markStartupOnce, startupMarks } from '@/features/diagnostics/startup-marks';

type Preferences = Pick<AppSettings, 'accent' | 'sidebarCollapsed' | 'homeFilter'>;

/** Clicking through colours writes settings.json once, after the clicking stops. */
export const PREFERENCE_SAVE_DELAY_MS = 400;

let flushPending: () => Promise<void> = () => Promise.resolve();

/** Saves a choice still waiting for its delay; closing and updating call this first. */
export function flushPreferenceSaves(): Promise<void> {
  return flushPending();
}

export const usePreferenceNotice = create<{
  message: string | null;
  dismiss: () => void;
}>((set) => ({ message: null, dismiss: () => set({ message: null }) }));

/**
 * Keeps the accent and sidebar stores in step with settings.json: saved values are applied when
 * settings load, and changes the user makes are saved in the background. The interface never
 * waits for the save, and keeps the user's choice if it fails.
 */
export function usePreferenceSync(settings: SettingsStore) {
  useEffect(() => {
    let synchronized: Preferences | null = null;
    let applyingSaved = false;
    let pending: Partial<Preferences> = {};
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function save() {
      timer = null;
      const patch = pending;
      pending = {};
      const result = await settings.getState().update(patch);
      if (result.ok) return;
      logFailure('preference-save-failed', result.error.code);
      usePreferenceNotice.setState({
        message: 'Your choice is applied, but it could not be saved for next time.',
      });
    }

    flushPending = async () => {
      if (timer === null) return;
      clearTimeout(timer);
      await save();
    };

    function schedule(patch: Partial<Preferences>) {
      pending = { ...pending, ...patch };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        void save();
      }, PREFERENCE_SAVE_DELAY_MS);
    }

    const unsubscribeSettings = settings.subscribe((state) => {
      const saved = state.settings;
      if (!saved) return;
      if (
        synchronized?.accent === saved.accent &&
        synchronized.sidebarCollapsed === saved.sidebarCollapsed &&
        synchronized.homeFilter === saved.homeFilter
      )
        return;
      synchronized = {
        accent: saved.accent,
        sidebarCollapsed: saved.sidebarCollapsed,
        homeFilter: saved.homeFilter,
      };
      applyingSaved = true;
      if (useAccentStore.getState().accent !== saved.accent)
        useAccentStore.getState().setAccent(saved.accent);
      if (useSidebarStore.getState().collapsedPreference !== saved.sidebarCollapsed)
        useSidebarStore.getState().restore(saved.sidebarCollapsed);
      if (useHomeFilterStore.getState().filter !== saved.homeFilter)
        useHomeFilterStore.getState().setFilter(saved.homeFilter);
      applyingSaved = false;
      markStartupOnce(startupMarks.settingsApplied);
    });
    const unsubscribeAccent = useAccentStore.subscribe((state, previous) => {
      if (!applyingSaved && state.accent !== previous.accent) schedule({ accent: state.accent });
    });
    const unsubscribeSidebar = useSidebarStore.subscribe((state, previous) => {
      if (!applyingSaved && state.collapsedPreference !== previous.collapsedPreference)
        schedule({ sidebarCollapsed: state.collapsedPreference });
    });
    const unsubscribeHomeFilter = useHomeFilterStore.subscribe((state, previous) => {
      if (!applyingSaved && state.filter !== previous.filter)
        schedule({ homeFilter: state.filter });
    });
    return () => {
      unsubscribeSettings();
      unsubscribeAccent();
      unsubscribeSidebar();
      unsubscribeHomeFilter();
      // A choice made just before unmounting is still saved.
      void flushPending();
      flushPending = () => Promise.resolve();
    };
  }, [settings]);
}
