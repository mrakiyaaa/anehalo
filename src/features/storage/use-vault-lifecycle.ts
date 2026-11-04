import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { describeStorageError } from '@/features/storage/repository-result';
import type { WorkspaceStore } from '@/store/workspace-store';

export function useVaultLifecycle(store: WorkspaceStore) {
  useEffect(() => {
    const refresh = () => {
      void store.getState().refreshTree();
    };
    const save = () => {
      void store.getState().saveCapture();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
      else save();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('blur', save);
    document.addEventListener('visibilitychange', handleVisibility);
    refresh();
    let disposed = false;
    let closeInProgress = false;
    const disposers: (() => void)[] = [];
    const register = (dispose: () => void) => {
      if (disposed) dispose();
      else disposers.push(dispose);
    };
    async function observeNativeWindow() {
      if (!isTauri()) return;
      try {
        const currentWindow = getCurrentWindow();
        register(
          await currentWindow.onFocusChanged(({ payload }) => {
            if (payload) refresh();
            else save();
          }),
        );
        register(
          await currentWindow.onCloseRequested(async (event) => {
            event.preventDefault();
            if (closeInProgress) return;
            closeInProgress = true;
            try {
              while (true) {
                const result = await store.getState().saveCapture();
                if (!result.ok) return;
                const capture = store.getState().capture;
                if (
                  capture.draft === capture.savedContent ||
                  (!capture.relativePath && !capture.draft.trim())
                )
                  break;
              }
              await currentWindow.destroy();
            } catch (error) {
              store
                .getState()
                .reportError(describeStorageError(error, 'Could not close the window.'));
            } finally {
              closeInProgress = false;
            }
          }),
        );
      } catch (error) {
        store
          .getState()
          .reportError(describeStorageError(error, 'Could not observe the vault window.'));
      }
    }
    void observeNativeWindow();
    return () => {
      disposed = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('blur', save);
      document.removeEventListener('visibilitychange', handleVisibility);
      for (const dispose of disposers) dispose();
    };
  }, [store]);
}
