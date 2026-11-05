import { ChoiceCard } from '@/features/onboarding/ChoiceCard';

interface FolderStepProps {
  defaultPath: string;
  selectedPath: string;
  customPath: string | null;
  isBusy: boolean;
  useDefault: () => void;
  chooseFolder: () => Promise<void>;
}

export function FolderStep({
  defaultPath,
  selectedPath,
  customPath,
  isBusy,
  useDefault,
  chooseFolder,
}: FolderStepProps) {
  return (
    <div className="onboarding-folder-stack">
      <div
        className="onboarding-choices"
        role="radiogroup"
        aria-label="Notes folder"
        aria-busy={isBusy}
      >
        <ChoiceCard
          group="location"
          value="default"
          checked={selectedPath === defaultPath}
          onChange={useDefault}
        >
          <div className="onboarding-choice-body">
            <div className="onboarding-choice-title">
              Use the default<span className="onboarding-recommended">Recommended</span>
            </div>
            <div className="onboarding-choice-sub">Created for you in your Documents folder.</div>
            <span className="onboarding-path">Documents\Anehalo</span>
          </div>
        </ChoiceCard>
        <ChoiceCard
          group="location"
          value="custom"
          checked={selectedPath !== defaultPath}
          onChange={() => {
            void chooseFolder();
          }}
        >
          <div className="onboarding-choice-body">
            <div className="onboarding-choice-title">Choose another folder</div>
            <div className="onboarding-choice-sub">
              Pick any folder, for example on another drive.
            </div>
            <span className="onboarding-path">{customPath ?? 'Choose a folder…'}</span>{' '}
            <button
              type="button"
              className="onboarding-button line small"
              disabled={isBusy}
              onClick={(event) => {
                event.preventDefault();
                void chooseFolder();
              }}
            >
              {isBusy ? 'Checking…' : 'Browse…'}
            </button>
          </div>
        </ChoiceCard>
      </div>
      <p className="onboarding-note">You can change this later.</p>
    </div>
  );
}
