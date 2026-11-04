import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useState } from 'react';

type WindowAction = 'minimize' | 'toggleMaximize' | 'close';

export function useWindowControls() {
  const isNativeWindow = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativeWindow) return;
    let isMounted = true;
    let unlisten: (() => void) | undefined;
    const currentWindow = getCurrentWindow();

    async function synchronizeMaximizedState() {
      try {
        const maximized = await currentWindow.isMaximized();
        if (isMounted) setIsMaximized(maximized);
      } catch {
        if (isMounted) setWindowError('The window state could not be read.');
      }
    }

    void synchronizeMaximizedState();
    void currentWindow
      .onResized(() => {
        void synchronizeMaximizedState();
      })
      .then((removeListener) => {
        if (isMounted) unlisten = removeListener;
        else removeListener();
      })
      .catch(() => {
        if (isMounted) setWindowError('Window size changes could not be observed.');
      });

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [isNativeWindow]);

  const runWindowAction = useCallback(
    async (action: WindowAction) => {
      if (!isNativeWindow) return;
      setWindowError(null);
      try {
        const currentWindow = getCurrentWindow();
        await currentWindow[action]();
        if (action === 'toggleMaximize') setIsMaximized(await currentWindow.isMaximized());
      } catch {
        setWindowError('The window action could not be completed. Please try again.');
      }
    },
    [isNativeWindow],
  );

  return { isNativeWindow, isMaximized, windowError, runWindowAction };
}
