import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';

export function AppShell() {
  return (
    <div className="grid h-dvh grid-rows-[3.75rem_minmax(0,1fr)_1.75rem] overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="grid min-h-0 grid-cols-[15rem_minmax(0,1fr)]">
        <Sidebar />
        <MainArea />
      </div>
      <StatusBar />
    </div>
  );
}
