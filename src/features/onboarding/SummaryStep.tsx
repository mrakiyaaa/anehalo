import { themeLabels, type AppSettings } from '@/features/settings/AppSettings';

export function SummaryStep({
  settings,
  defaultPath,
}: {
  settings: AppSettings;
  defaultPath: string;
}) {
  return (
    <div className="onboarding-summary">
      <div className="onboarding-summary-row">
        <span>Name</span>
        <b>{settings.userName.trim() || 'No name'}</b>
      </div>
      <div className="onboarding-summary-row">
        <span>Notes folder</span>
        <b>{settings.vaultPath === defaultPath ? 'Documents\\Anehalo' : settings.vaultPath}</b>
      </div>
      <div className="onboarding-summary-row">
        <span>Theme</span>
        <b>{themeLabels[settings.theme]}</b>
      </div>
    </div>
  );
}
