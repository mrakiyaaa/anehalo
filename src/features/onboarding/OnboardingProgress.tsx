import { onboardingSteps } from '@/features/onboarding/onboarding-steps';
import { mergeClassNames } from '@/lib/utils';

export function OnboardingProgress({ step, isSummary }: { step: number; isSummary: boolean }) {
  return (
    <div className="onboarding-progress">
      {!isSummary && (
        <>
          <div className="onboarding-dots" aria-hidden="true">
            {onboardingSteps.map(({ id }, index) => (
              <span
                key={id}
                className={mergeClassNames(
                  'onboarding-dot',
                  index < step && 'done',
                  index === step && 'now',
                )}
              />
            ))}
          </div>
          <span className="onboarding-count">
            Step {step + 1} of {onboardingSteps.length}
          </span>
        </>
      )}
    </div>
  );
}
