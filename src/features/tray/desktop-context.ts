import { createContext, useContext } from 'react';
import type { DesktopRuntime } from './DesktopRuntime';

export const DesktopContext = createContext<DesktopRuntime | null>(null);
export function useDesktopRuntime() {
  const runtime = useContext(DesktopContext);
  if (!runtime) throw new Error('Desktop services are unavailable.');
  return runtime;
}
