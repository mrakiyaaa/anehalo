import { TauriGlobalShortcutService } from '@/features/shortcuts/TauriGlobalShortcutService';
import { TauriTrayService } from '@/features/tray/TauriTrayService';
import { TauriUpdateService } from '@/features/updates/TauriUpdateService';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/styles/globals.css';
import { TauriNoteRepository } from '@/features/storage/TauriNoteRepository';
import { TauriSettingsRepository } from '@/features/settings/TauriSettingsRepository';
import { TauriFolderAccess } from '@/features/onboarding/TauriFolderAccess';
import type { AppServices } from '@/app/app-services';
import { TauriAttachmentRepository } from '@/features/attachments/TauriAttachmentRepository';
import { TauriExportPlatform } from '@/features/export/TauriExportPlatform';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { observeUnhandledErrors } from '@/features/diagnostics/error-logging';

observeUnhandledErrors();

const services: AppServices = {
  desktop: {
    shortcuts: new TauriGlobalShortcutService(),
    tray: new TauriTrayService(),
    updater: new TauriUpdateService(),
  },
  settingsRepository: new TauriSettingsRepository(),
  folderAccess: new TauriFolderAccess(),
  createNoteRepository: (vaultPath) => new TauriNoteRepository(vaultPath),
  createAttachmentRepository: (vaultPath) => new TauriAttachmentRepository(vaultPath),
  createExportPlatform: (vaultPath) => new TauriExportPlatform(vaultPath),
};

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to start Anehalo: the root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders services={services}>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
