import { createContext, useContext } from 'react';
import type { FolderAccess } from '@/features/onboarding/FolderAccess';
import type { SettingsRepository } from '@/features/settings/SettingsRepository';
import type { NoteRepository } from '@/features/storage/NoteRepository';

export interface AppServices {
  settingsRepository: SettingsRepository;
  folderAccess: FolderAccess;
  createNoteRepository: (vaultPath: string) => NoteRepository;
}

export const AppServicesContext = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('Application services are unavailable.');
  return services;
}
