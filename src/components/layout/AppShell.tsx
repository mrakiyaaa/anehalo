import { useRef } from 'react';
import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { useQuickCaptureShortcut } from '@/features/editor/use-quick-capture-shortcut';

export function AppShell() {
  const captureReference = useRef<HTMLTextAreaElement>(null);
  useQuickCaptureShortcut(captureReference);

  return (
    <div className="app-shell">
      <TitleBar />
      <Sidebar onQuickNote={() => captureReference.current?.focus()} />
      <MainArea captureReference={captureReference} />
      <StatusBar />
    </div>
  );
}
