import { invoke } from '@tauri-apps/api/core';

interface RuntimePaths {
  readonly vault: string;
  readonly settings: string;
  readonly isolated: boolean;
}

let paths: Promise<RuntimePaths> | undefined;

export function runtimePaths(): Promise<RuntimePaths> {
  paths ??= invoke<RuntimePaths>('runtime_paths');
  return paths;
}
