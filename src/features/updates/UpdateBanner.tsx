import { useStore } from 'zustand';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { visibleUpdate, type UpdateStatus } from './UpdateController';

export interface UpdateBannerActions {
  install: () => void;
  later: () => void;
  dismiss: () => void;
}

export function UpdateBannerView({
  update,
  actions,
}: {
  update: UpdateStatus;
  actions: UpdateBannerActions;
}) {
  if (update.kind === 'idle') return null;
  if (update.kind === 'available')
    return (
      <div className="update-banner" role="status" data-state="available">
        <p>Anehalo {update.version} is available</p>
        <button type="button" onClick={actions.install}>
          Update now
        </button>
        <button type="button" onClick={actions.later}>
          Later
        </button>
      </div>
    );
  if (update.kind === 'error')
    return (
      <div className="update-banner" role="alert" data-state="error">
        <p>{update.message}</p>
        <button type="button" onClick={actions.install}>
          Try again
        </button>
        <button type="button" aria-label="Dismiss update message" onClick={actions.dismiss}>
          ×
        </button>
      </div>
    );
  const percent =
    update.kind === 'downloading' && update.total
      ? Math.min(100, Math.round((update.downloaded / update.total) * 100))
      : null;
  return (
    <div className="update-banner" role="status" data-state={update.kind}>
      <p>
        {update.kind === 'installing'
          ? `Installing Anehalo ${update.version}. It will restart by itself.`
          : `Downloading Anehalo ${update.version}${percent === null ? '…' : `… ${percent}%`}`}
      </p>
      <progress aria-label="Update progress" max={100} value={percent ?? undefined} />
    </div>
  );
}

export function UpdateBanner() {
  const { updates } = useDesktopRuntime();
  const update = useStore(updates.state, visibleUpdate);
  return (
    <UpdateBannerView
      update={update}
      actions={{
        install: () => {
          void updates.installNow();
        },
        later: () => updates.later(),
        dismiss: () => updates.dismissError(),
      }}
    />
  );
}
