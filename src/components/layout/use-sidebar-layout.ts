import { useEffect } from 'react';
import { appShortcuts, isShortcutBlocked } from '@/features/shortcuts/app-shortcuts';
import { NARROW_WINDOW_WIDTH, useSidebarStore } from '@/store/sidebar-store';

/** Collapses the sidebar in narrow windows and toggles it with Ctrl+\. */
export function useSidebarLayout() {
  const toggle = useSidebarStore((state) => state.toggle);
  const setNarrowWindow = useSidebarStore((state) => state.setNarrowWindow);

  useEffect(() => {
    const narrow = window.matchMedia(`(max-width: ${NARROW_WINDOW_WIDTH - 1}px)`);
    // The first reading is applied without animation, like a restored preference.
    useSidebarStore.setState({ isNarrowWindow: narrow.matches });
    const handleChange = (event: MediaQueryListEvent) => setNarrowWindow(event.matches);
    narrow.addEventListener('change', handleChange);
    return () => narrow.removeEventListener('change', handleChange);
  }, [setNarrowWindow]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!appShortcuts.toggleSidebar.matches(event) || event.repeat) return;
      if (isShortcutBlocked(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggle]);
}
