import { useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useAppServices } from '@/app/app-services';
import { SettingsContext } from '@/features/settings/settings-context';
import type { WorkspaceStore } from '@/store/workspace-store';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { FakeTrayService } from './FakeTrayService';
import { DesktopRuntime } from './DesktopRuntime';
import { DesktopContext } from './desktop-context';

export function DesktopProvider({ store, children }: PropsWithChildren<{ store: WorkspaceStore }>) {
  const services = useAppServices();
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error('Settings are unavailable.');
  const [runtime] = useState(
    () =>
      new DesktopRuntime(
        store,
        settings,
        services.desktop?.shortcuts ?? new FakeGlobalShortcutService(),
        services.desktop?.tray ?? new FakeTrayService(),
      ),
  );
  useEffect(() => {
    void runtime.connect();
    return () => {
      void runtime.stop();
    };
  }, [runtime]);
  return <DesktopContext.Provider value={runtime}>{children}</DesktopContext.Provider>;
}
