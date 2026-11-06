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
  revertPending: (keys: readonly (keyof AppSettings)[]) => void;
  update: (patch: Partial<AppSettings>) => Promise<RepositoryResult<AppSettings>>;
  updateTheme: (theme: ThemePreference) => Promise<void>;
  updateLastOpenedNote: (path: string | null) => Promise<void>;
  updateLastExportFolder: (path: string) => Promise<RepositoryResult<void>>;
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
    revertPending: (keys) => {
      const { settings, pendingSettings } = get();
      if (settings && pendingSettings) {
        const reverted = {
          ...pendingSettings,
          ...Object.fromEntries(keys.map((key) => [key, settings[key]])),
        };
        set({ pendingSettings: reverted });
      }
    },
    update: (patch) => {
      const settings = get().pendingSettings ?? get().settings;
      return settings
        ? get().save({ ...settings, ...patch })
        : Promise.resolve(failure({ code: 'unavailable', message: 'Settings have not loaded.' }));
    },
    updateTheme: async (theme) => {
      const settings = get().pendingSettings ?? get().settings;
      if (settings?.onboardingCompleted) await get().save({ ...settings, theme });
    },
    updateLastOpenedNote: async (lastOpenedNotePath) => {
      const settings = get().pendingSettings ?? get().settings;
      if (settings?.onboardingCompleted && settings.lastOpenedNotePath !== lastOpenedNotePath)
        await get().save({ ...settings, lastOpenedNotePath });
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
    updateLastExportFolder: async (lastExportFolder) => {
      const settings = get().pendingSettings ?? get().settings;
      if (!settings) return failure({ code: 'unavailable', message: 'Settings have not loaded.' });
      const result = await get().save({ ...settings, lastExportFolder });
      return result.ok ? success(undefined) : result;
    },
  }));
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
