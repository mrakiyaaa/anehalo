import { usePreferenceNotice } from './preference-sync';

/** A small toast for a preference that applied but could not be saved. */
export function PreferenceNotice() {
  const message = usePreferenceNotice((state) => state.message);
  const dismiss = usePreferenceNotice((state) => state.dismiss);
  if (!message) return null;
  return (
    <div className="desktop-notice" role="status">
      <p>{message}</p>
      <button type="button" aria-label="Dismiss notice" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
