import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { describeStorageError, type RepositoryResult } from '@/features/storage/repository-result';
import type { WorkspaceStore } from '@/store/workspace-store';

export function useVaultLifecycle(
  store: WorkspaceStore,
  flushSettings: () => Promise<RepositoryResult<void>>,
) {
  useEffect(() => {
    store.getState().resumeAutoSave();
    const refresh = () => {
      void (async () => {
        await store.getState().checkOpenNote();
        await store.getState().refreshTree();
      })();
    };
    const save = () => {
      void store.getState().flushNotes();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
      else save();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('blur', save);
    document.addEventListener('visibilitychange', handleVisibility);
    void store.getState().initialize();
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
            store.getState().setClosing(true);
            try {
              const notesResult = await store.getState().flushNotes();
              if (!notesResult.ok) {
                store.getState().reportError(notesResult.error);
                return;
              }
              const settingsResult = await flushSettings();
              if (!settingsResult.ok) return;
              const finalNotes = await store.getState().flushNotes();
              if (!finalNotes.ok) {
                store.getState().reportError(finalNotes.error);
                return;
              }
              await currentWindow.destroy();
            } catch (error) {
              store
                .getState()
                .reportError(describeStorageError(error, 'Could not close the window.'));
            } finally {
              closeInProgress = false;
              store.getState().setClosing(false);
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
      store.getState().pauseAutoSave();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('blur', save);
      document.removeEventListener('visibilitychange', handleVisibility);
      for (const dispose of disposers) dispose();
    };
  }, [store, flushSettings]);
}
