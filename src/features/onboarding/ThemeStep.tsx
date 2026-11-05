import { useState } from 'react';
import { flushSync } from 'react-dom';
import { ChoiceCard } from '@/features/onboarding/ChoiceCard';
import { themeLabels, type ThemePreference } from '@/features/settings/AppSettings';
import { transitionTheme } from '@/features/theme/transition-theme';
import { useThemeStore } from '@/store/theme-store';
import { mergeClassNames } from '@/lib/utils';

function MiniWindow({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div className={`onboarding-mini preview-${mode}`}>
      <span className="mini-sidebar" />
      <div className="mini-main">
        <b />
        <b />
        <b />
      </div>
    </div>
  );
}

function ThemePreview({ mode }: { mode: ThemePreference }) {
  return (
    <div
      className={mergeClassNames('onboarding-preview', mode === 'system' && 'split')}
      aria-hidden="true"
    >
      {mode === 'system' ? (
        <>
          <MiniWindow mode="light" />
          <MiniWindow mode="dark" />
        </>
      ) : (
        <MiniWindow mode={mode} />
      )}
    </div>
  );
}

export function ThemeStep() {
  const preference = useThemeStore((state) => state.preference) ?? 'system';
  const setPreference = useThemeStore((state) => state.setPreference);
  const [error, setError] = useState<string | null>(null);
  async function selectTheme(mode: ThemePreference) {
    const card = document
      .querySelector<HTMLInputElement>(`input[name="onboarding-theme"][value="${mode}"]`)
      ?.closest('label');
    const bounds = card?.getBoundingClientRect();
    try {
      await transitionTheme(
        {
          horizontal: bounds ? bounds.left + bounds.width / 2 : innerWidth / 2,
          vertical: bounds ? bounds.top + bounds.height / 2 : innerHeight / 2,
        },
        () => flushSync(() => setPreference(mode)),
      );
      setError(null);
    } catch {
      setError('Your theme could not be changed. Please try again.');
    }
  }
  return (
    <>
      <div className="onboarding-themes" role="radiogroup" aria-label="Theme">
        {(['light', 'dark', 'system'] as const).map((mode) => (
          <ChoiceCard
            key={mode}
            group="onboarding-theme"
            value={mode}
            checked={preference === mode}
            onChange={() => {
              void selectTheme(mode);
            }}
            className="onboarding-theme-card"
            hideMark
          >
            <ThemePreview mode={mode} />
            <span className="onboarding-theme-label">
              <span className="onboarding-mark" aria-hidden="true" />
              {themeLabels[mode]}
            </span>
          </ChoiceCard>
        ))}
      </div>
      {error && (
        <p role="alert" className="onboarding-error">
          {error}
        </p>
      )}
    </>
  );
}
