import { useEffect } from 'react';
import { useStore } from 'zustand';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { isTypingInDiagramText } from '@/features/shortcuts/typing-target';
import { appShortcuts } from '@/features/shortcuts/app-shortcuts';

/** Back and forward through the notes and diagrams opened in this session. */
export function HistoryNavigation() {
  const navigation = useWorkspaceStore((state) => state.navigation);
  const navigate = useWorkspaceStore((state) => state.navigateHistory);
  const isClosing = useWorkspaceStore((state) => state.isClosing);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const position = useStore(navigation, (state) => state.position);
  const length = useStore(navigation, (state) => state.paths.length);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const direction = appShortcuts.back.matches(event)
        ? -1
        : appShortcuts.forward.matches(event)
          ? 1
          : null;
      if (direction === null || isTypingInDiagramText(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      // A note is on screen before its open finishes, so a key pressed then would be lost.
      // History moves are queued behind that change instead.
      if (!isClosing) void navigate(direction);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [navigate, isClosing]);
  return (
    <span className="history-navigation" role="group" aria-label="History">
      <button
        type="button"
        aria-label="Back"
        title="Back (Alt+Left)"
        disabled={disabled || position <= 0}
        onClick={() => {
          void navigate(-1);
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        type="button"
        aria-label="Forward"
        title="Forward (Alt+Right)"
        disabled={disabled || position >= length - 1}
        onClick={() => {
          void navigate(1);
        }}
      >
        <ArrowRight size={16} />
      </button>
    </span>
  );
}
