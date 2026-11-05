import { createStore } from 'zustand/vanilla';
import type { AppSettings, ThemePreference } from '@/features/settings/AppSettings';
import { limitUserName, normalizeUserName } from '@/features/settings/AppSettings';
import type { FolderAccess } from '@/features/onboarding/FolderAccess';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import type { RepositoryError, RepositoryResult } from '@/features/storage/repository-result';
import { failure } from '@/features/storage/repository-result';
import { onboardingSteps } from '@/features/onboarding/onboarding-steps';

interface OnboardingDependencies {
  defaults: AppSettings;
  folderAccess: FolderAccess;
  createNoteRepository: (vaultPath: string) => NoteRepository;
  saveSettings: (settings: AppSettings) => Promise<RepositoryResult<AppSettings>>;
}

interface OnboardingState {
  step: number;
  direction: 1 | -1;
  isSummary: boolean;
  skipped: boolean;
  answers: AppSettings;
  customPath: string | null;
  isBusy: boolean;
  error: RepositoryError | null;
  next: () => void;
  back: () => void;
  skip: () => void;
  replay: () => void;
  setName: (name: string) => void;
  setTheme: (theme: ThemePreference) => void;
  useDefaultFolder: () => void;
  chooseFolder: () => Promise<void>;
  finish: () => Promise<RepositoryResult<AppSettings>>;
}

export function createOnboardingStore(dependencies: OnboardingDependencies) {
  const { defaults, folderAccess, createNoteRepository, saveSettings } = dependencies;
  return createStore<OnboardingState>()((set, get) => ({
    step: 0,
    direction: 1,
    isSummary: false,
    skipped: false,
    answers: defaults,
    customPath: null,
    isBusy: false,
    error: null,
    next: () => {
      if (get().isBusy || get().isSummary) return;
      if (get().step === onboardingSteps.length - 1)
        set({ isSummary: true, direction: 1, error: null });
      else set({ step: get().step + 1, direction: 1, error: null });
    },
    back: () => {
      if (get().isBusy) return;
      if (get().isSummary) set({ isSummary: false, direction: -1, error: null });
      else set({ step: Math.max(0, get().step - 1), direction: -1, error: null });
    },
    skip: () =>
      set({ answers: defaults, skipped: true, isSummary: true, direction: 1, error: null }),
    replay: () =>
      set({
        step: 0,
        direction: 1,
        isSummary: false,
        skipped: false,
        answers: defaults,
        customPath: null,
        error: null,
      }),
    setName: (name) => set({ answers: { ...get().answers, userName: limitUserName(name) } }),
    setTheme: (theme) => set({ answers: { ...get().answers, theme } }),
    useDefaultFolder: () =>
      set({ answers: { ...get().answers, vaultPath: defaults.vaultPath }, error: null }),
    chooseFolder: async () => {
      if (get().isBusy) return;
      set({ isBusy: true, error: null });
      const chosen = await folderAccess.choose();
      if (!chosen.ok) {
        set({ isBusy: false, error: chosen.error });
        return;
      }
      if (!chosen.value) {
        set({ isBusy: false });
        return;
      }
      const validated = await folderAccess.validate(chosen.value);
      if (!validated.ok) set({ isBusy: false, error: validated.error });
      else
        set({
          customPath: chosen.value,
          answers: { ...get().answers, vaultPath: chosen.value },
          isBusy: false,
        });
    },
    finish: async () => {
      if (get().isBusy || !get().isSummary)
        return failure({
          code: 'unavailable',
          message: 'Review your setup before opening Anehalo.',
        });
      set({ isBusy: true, error: null });
      const settings = {
        ...get().answers,
        userName: normalizeUserName(get().answers.userName),
        onboardingCompleted: true,
      };
      const validated = await folderAccess.validate(settings.vaultPath);
      if (!validated.ok) {
        set({ isBusy: false, error: validated.error });
        return validated;
      }
      const initialized = await createNoteRepository(settings.vaultPath).initializeVault();
      if (!initialized.ok) {
        set({ isBusy: false, error: initialized.error });
        return initialized;
      }
      const saved = await saveSettings(settings);
      set({ isBusy: false, error: saved.ok ? null : saved.error });
      return saved;
    },
  }));
}
