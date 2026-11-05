import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useAppServices } from '@/app/app-services';
import { TitleBar } from '@/components/layout/TitleBar';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { normalizeUserName } from '@/features/settings/AppSettings';
import { useThemeStore } from '@/store/theme-store';
import { createOnboardingStore } from '@/features/onboarding/onboarding-store';
import { onboardingSteps, summaryScene } from '@/features/onboarding/onboarding-steps';
import { OnboardingVisual } from '@/features/onboarding/OnboardingVisual';
import { OnboardingProgress } from '@/features/onboarding/OnboardingProgress';
import { OnboardingActions } from '@/features/onboarding/OnboardingActions';
import { WelcomeStep } from '@/features/onboarding/WelcomeStep';
import { NameStep } from '@/features/onboarding/NameStep';
import { FolderStep } from '@/features/onboarding/FolderStep';
import { ThemeStep } from '@/features/onboarding/ThemeStep';
import { TipsStep } from '@/features/onboarding/TipsStep';
import { SummaryStep } from '@/features/onboarding/SummaryStep';

export function Onboarding() {
  const defaults = useSettingsStore((state) => state.defaults);
  const saveSettings = useSettingsStore((state) => state.save);
  const services = useAppServices();
  const [store] = useState(() => {
    if (!defaults) throw new Error('Default settings must be loaded before onboarding.');
    return createOnboardingStore({ defaults, saveSettings, ...services });
  });
  const state = useStore(store);
  const preference = useThemeStore((themeState) => themeState.preference);
  const heading = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  const step = onboardingSteps[state.step] ?? onboardingSteps[0];
  const sceneKey = state.isSummary ? 'summary' : step.id;
  useEffect(() => {
    store.getState().setTheme(preference ?? 'system');
  }, [preference, store]);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [sceneKey]);

  function resetTheme(action: () => void) {
    action();
    useThemeStore.getState().setPreference('system');
  }

  const title = state.isSummary
    ? `You are all set${normalizeUserName(state.answers.userName) ? `, ${normalizeUserName(state.answers.userName)}` : ''}`
    : step.title;
  const lead = state.isSummary
    ? state.skipped
      ? 'Setup skipped. We used the defaults, and you can change them later.'
      : 'Your notes are ready. Everything below can be changed later.'
    : step.lead;
  const content = state.isSummary ? (
    <SummaryStep settings={state.answers} defaultPath={defaults?.vaultPath ?? ''} />
  ) : (
    {
      welcome: <WelcomeStep />,
      name: <NameStep name={state.answers.userName} setName={state.setName} />,
      folder: (
        <FolderStep
          defaultPath={defaults?.vaultPath ?? ''}
          selectedPath={state.answers.vaultPath}
          customPath={state.customPath}
          isBusy={state.isBusy}
          useDefault={state.useDefaultFolder}
          chooseFolder={state.chooseFolder}
        />
      ),
      theme: <ThemeStep />,
      tips: <TipsStep />,
    }[step.id]
  );

  return (
    <div className="onboarding-shell">
      <TitleBar />
      <main className="onboarding-stage">
        <OnboardingVisual
          scene={state.isSummary ? summaryScene : step}
          sceneKey={sceneKey}
          welcome={!state.isSummary && step.id === 'welcome'}
        />
        <section
          className="onboarding-panel"
          aria-labelledby="onboarding-heading"
          aria-busy={state.isBusy}
        >
          <OnboardingProgress step={state.step} isSummary={state.isSummary} />
          <motion.div
            key={sceneKey}
            className="onboarding-content"
            initial={reducedMotion ? false : { opacity: 0, x: state.direction * 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h1 id="onboarding-heading" ref={heading} tabIndex={-1} className="onboarding-title">
              {title}
            </h1>
            <p className="onboarding-lead">{lead}</p>
            {content}
            {state.error && (
              <p role="alert" className="onboarding-error">
                {state.error.message}
              </p>
            )}
          </motion.div>
          <OnboardingActions
            step={state.step}
            isSummary={state.isSummary}
            isBusy={state.isBusy}
            next={state.next}
            back={state.back}
            skip={() => resetTheme(state.skip)}
            replay={() => resetTheme(state.replay)}
            finish={() => {
              void state.finish();
            }}
          />
        </section>
      </main>
    </div>
  );
}
