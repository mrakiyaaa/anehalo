import { useEffect } from 'react';
import { useStore } from 'zustand';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { isTypingInDiagramText } from '@/features/shortcuts/typing-target';

/** Back and forward through the notes and diagrams opened in this session. */
export function HistoryNavigation() {
  const navigation = useWorkspaceStore((state) => state.navigation);
  const navigate = useWorkspaceStore((state) => state.navigateHistory);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const position = useStore(navigation, (state) => state.position);
  const length = useStore(navigation, (state) => state.paths.length);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
        isTypingInDiagramText(event.target)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) void navigate(event.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [navigate, disabled]);
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
