import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/features/settings/use-settings-store';

export function SettingsNotice() {
  const error = useSettingsStore((state) => state.error);
  const settings = useSettingsStore((state) => state.pendingSettings);
  const save = useSettingsStore((state) => state.save);
  const isSaving = useSettingsStore((state) => state.isSaving);
  if (!error || !settings) return null;
  return (
    <div className="storage-error" role="alert">
      <p>{error.message}</p>
      <Button
        variant="outline"
        disabled={isSaving}
        onClick={() => {
          void save(settings);
        }}
      >
        Retry saving settings
      </Button>
    </div>
  );
}
