import { AppShell } from '@/components/layout/AppShell';
import { TitleBar } from '@/components/layout/TitleBar';
import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { WorkspaceProvider } from '@/features/storage/WorkspaceProvider';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { useMemo } from 'react';

export function App() {
  const settings = useSettingsStore((state) => state.settings);
  const error = useSettingsStore((state) => state.error);
  const load = useSettingsStore((state) => state.load);
  const services = useAppServices();
  const completedVaultPath = settings?.onboardingCompleted ? settings.vaultPath : null;
  const repository = useMemo(
    () => (completedVaultPath ? services.createNoteRepository(completedVaultPath) : null),
    [services, completedVaultPath],
  );

  if (!settings)
    return (
      <div className="onboarding-shell">
        <TitleBar />
        <main className="startup-status">
          {error ? (
            <>
              <p role="alert">{error.message}</p>
              <button
                type="button"
                onClick={() => {
                  void load();
                }}
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status">Opening Anehalo…</p>
          )}
        </main>
      </div>
    );
  if (!settings.onboardingCompleted) return <Onboarding />;
  if (!repository) throw new Error('The notes repository was not initialized.');
  return (
    <WorkspaceProvider key={settings.vaultPath} repository={repository}>
      <AppShell />
    </WorkspaceProvider>
  );
}
