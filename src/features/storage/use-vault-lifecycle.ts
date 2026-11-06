import { useEffect } from 'react';
import type { WorkspaceStore } from '@/store/workspace-store';

export function useVaultLifecycle(store: WorkspaceStore) {
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
    return () => {
      store.getState().pauseAutoSave();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('blur', save);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [store]);
}
