import { motion, useReducedMotion } from 'motion/react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Icon } from '@/components/ui/Icon';
import type { OnboardingScene } from '@/features/onboarding/onboarding-steps';

export function OnboardingVisual({
  scene,
  sceneKey,
  welcome,
}: {
  scene: OnboardingScene;
  sceneKey: string;
  welcome: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div className={`onboarding-visual tone-${scene.tone}`} aria-hidden="true">
      <div className="onboarding-scene">
        <motion.div
          key={sceneKey}
          className="onboarding-hero"
          initial={reducedMotion ? false : { scale: 0.7, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.34, 1.5, 0.5, 1] }}
        >
          {welcome ? <AppLogo /> : <Icon name={scene.hero} />}
        </motion.div>
        {scene.floaters.map(([icon, label], index) => (
          <span key={index} className={`onboarding-float onboarding-float-${index + 1}`}>
            <Icon name={icon} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
