import { createStore } from 'zustand/vanilla';
import type { AppSettings, ThemePreference } from '@/features/settings/AppSettings';
import type { SettingsRepository } from '@/features/settings/SettingsRepository';
import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';

interface SettingsState {
  settings: AppSettings | null;
  defaults: AppSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: RepositoryError | null;
  pendingSettings: AppSettings | null;
  load: () => Promise<void>;
  save: (settings: AppSettings) => Promise<RepositoryResult<AppSettings>>;
  updateTheme: (theme: ThemePreference) => Promise<void>;
  flushPendingSaves: () => Promise<RepositoryResult<void>>;
}

export function createSettingsStore(repository: SettingsRepository) {
  let loading: Promise<void> | null = null;
  let saving: Promise<unknown> = Promise.resolve();
  let pendingSaves = 0;
  let latestSave = 0;
  return createStore<SettingsState>()((set, get) => ({
    settings: null,
    defaults: null,
    isLoading: true,
    isSaving: false,
    error: null,
    pendingSettings: null,
    load: () => {
      loading ??= (async () => {
        set({ isLoading: true, error: null });
        const defaults = await repository.defaults();
        if (!defaults.ok) {
          set({ error: defaults.error, isLoading: false });
          loading = null;
          return;
        }
        const result = await repository.load();
        if (result.ok) set({ settings: result.value, defaults: defaults.value, isLoading: false });
        else {
          set({ error: result.error, isLoading: false });
          loading = null;
        }
      })();
      return loading;
    },
    save: (settings) => {
      const saveIdentifier = ++latestSave;
      pendingSaves += 1;
      set({ isSaving: true, error: null, pendingSettings: settings });
      const task = saving.then(async () => {
        const result = await repository.save(settings);
        pendingSaves -= 1;
        if (result.ok)
          set({
            settings: result.value,
            isSaving: pendingSaves > 0,
            ...(saveIdentifier === latestSave ? { pendingSettings: null, error: null } : {}),
          });
        else set({ error: result.error, isSaving: pendingSaves > 0 });
        return result;
      });
      saving = task;
      return task;
    },
    updateTheme: async (theme) => {
      const settings = get().settings;
      if (settings?.onboardingCompleted) await get().save({ ...settings, theme });
    },
    flushPendingSaves: async () => {
      let awaitedSave: Promise<unknown>;
      do {
        awaitedSave = saving;
        await awaitedSave;
      } while (awaitedSave !== saving);
      const error = get().error;
      return error && get().pendingSettings ? failure(error) : success(undefined);
    },
  }));
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
