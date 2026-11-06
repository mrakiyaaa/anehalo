import type { RepositoryResult } from '@/features/storage/repository-result';

export interface TrayEvents {
  close: () => void;
  quit: () => void;
  quickNote: () => void;
  settings: () => void;
  focus: () => void;
}
export interface TrayService {
  observe(events: TrayEvents): Promise<RepositoryResult<() => void>>;
  show(): Promise<RepositoryResult<void>>;
  hide(): Promise<RepositoryResult<void>>;
  quit(): Promise<RepositoryResult<void>>;
  setAutostart(enabled: boolean): Promise<RepositoryResult<void>>;
  focusEditor(): void;
}
