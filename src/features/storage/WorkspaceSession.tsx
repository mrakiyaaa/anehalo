import { useMemo } from 'react';
import { useAppServices } from '@/app/app-services';
import { AppShell } from '@/components/layout/AppShell';
import { WorkspaceProvider } from './WorkspaceProvider';

export function WorkspaceSession({ path, recovered }: { path: string; recovered: () => void }) {
  const services = useAppServices();
  const repository = useMemo(() => services.createNoteRepository(path), [services, path]);
  return (
    <WorkspaceProvider repository={repository} recovered={recovered}>
      <AppShell />
    </WorkspaceProvider>
  );
}
