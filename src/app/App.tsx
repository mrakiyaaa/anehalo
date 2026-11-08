import { TitleBar } from '@/components/layout/TitleBar';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { WorkspaceSession } from '@/features/storage/WorkspaceSession';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { useState } from 'react';

export function App() {
  const settings = useSettingsStore((state) => state.settings);
  const error = useSettingsStore((state) => state.error);
  const load = useSettingsStore((state) => state.load);
  const [sessionRevision, setSessionRevision] = useState(0);
  const completedVaultPath = settings?.onboardingCompleted ? settings.vaultPath : null;

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
  if (completedVaultPath === null) throw new Error('The notes path is unavailable.');
  return (
    <WorkspaceSession
      key={`${completedVaultPath}:${sessionRevision}`}
      path={completedVaultPath}
      recovered={() => setSessionRevision((revision) => revision + 1)}
    />
  );
}
