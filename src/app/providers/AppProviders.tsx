import { StartupTrayBridge } from '@/features/tray/StartupTrayBridge';
import { MotionConfig } from 'motion/react';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { SettingsProvider } from '@/features/settings/SettingsProvider';
import { AppServicesContext, type AppServices } from '@/app/app-services';

export function AppProviders({ children, services }: PropsWithChildren<{ services: AppServices }>) {
  return (
    <ThemeProvider>
      <AppServicesContext.Provider value={services}>
        <SettingsProvider repository={services.settingsRepository}>
          <MotionConfig reducedMotion="user">
            <StartupTrayBridge />
            {children}
          </MotionConfig>
        </SettingsProvider>
      </AppServicesContext.Provider>
    </ThemeProvider>
  );
}
