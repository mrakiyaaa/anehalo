import { Icon } from '@/components/ui/Icon';
import { onboardingSteps } from '@/features/onboarding/onboarding-steps';

interface OnboardingActionsProps {
  step: number;
  isSummary: boolean;
  isBusy: boolean;
  next: () => void;
  back: () => void;
  skip: () => void;
  replay: () => void;
  finish: () => void;
}

export function OnboardingActions({
  step,
  isSummary,
  isBusy,
  next,
  back,
  skip,
  replay,
  finish,
}: OnboardingActionsProps) {
  const isLast = step === onboardingSteps.length - 1;
  if (isSummary)
    return (
      <div className="onboarding-actions">
        <button
          className="onboarding-button primary"
          type="button"
          disabled={isBusy}
          onClick={finish}
        >
          {isBusy ? 'Preparing your notes…' : 'Open Anehalo'}
          <Icon name="right" />
        </button>
        <span className="onboarding-spacer" />
        <button className="onboarding-button text" type="button" disabled={isBusy} onClick={replay}>
          Replay onboarding
        </button>
      </div>
    );
  return (
    <div className="onboarding-actions">
      {step > 0 && (
        <button className="onboarding-button line" type="button" disabled={isBusy} onClick={back}>
          <Icon name="left" />
          Back
        </button>
      )}
      <span className="onboarding-spacer" />
      {!isLast && (
        <button className="onboarding-button text" type="button" disabled={isBusy} onClick={skip}>
          Skip setup
        </button>
      )}
      <button className="onboarding-button primary" type="button" disabled={isBusy} onClick={next}>
        {step === 0 ? 'Get started' : isLast ? 'Start writing' : 'Next'}
        <Icon name="right" />
      </button>
    </div>
  );
}
