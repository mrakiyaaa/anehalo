import type { RepositoryError, RepositoryResult } from '@/features/storage/repository-result';

export interface WindowState {
  visible: boolean;
  minimized: boolean;
  focused: boolean;
}

export interface TrayEvents {
  close: () => void;
  quit: () => void;
  quickNote: () => void;
  settings: () => void;
  focus: () => void;
  open: () => void;
  toggle: () => void;
  error: (error: RepositoryError) => void;
  arguments?: (launchArguments: readonly string[]) => Promise<RepositoryResult<void>>;
}
export interface TrayService {
  observe(events: TrayEvents): Promise<RepositoryResult<() => void>>;
  show(): Promise<RepositoryResult<void>>;
  hide(): Promise<RepositoryResult<void>>;
  minimize(): Promise<RepositoryResult<void>>;
  windowState(): Promise<RepositoryResult<WindowState>>;
  initialArguments(): Promise<RepositoryResult<readonly string[]>>;
  quit(): Promise<RepositoryResult<void>>;
  setAutostart(enabled: boolean): Promise<RepositoryResult<void>>;
  focusEditor(): void;
}
