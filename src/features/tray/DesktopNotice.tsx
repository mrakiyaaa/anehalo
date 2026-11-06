import { useStore } from 'zustand';
import { useDesktopRuntime } from './desktop-context';

export function DesktopNotice() {
  const runtime = useDesktopRuntime();
  const error = useStore(runtime.state, (state) => state.error);
  const toast = useStore(runtime.state, (state) => state.toast);
  if (!error && !toast) return null;
  return (
    <div className="desktop-notice" role={error ? 'alert' : 'status'}>
      <p>{error?.message ?? toast}</p>
      {error && (
        <button type="button" onClick={() => runtime.openSettings()}>
          Open Settings
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss desktop notice"
        onClick={() => runtime.clearNotice()}
      >
        ×
      </button>
    </div>
  );
}
