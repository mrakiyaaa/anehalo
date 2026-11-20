import { AccentSwatchPicker } from '@/features/theme/AccentSwatchPicker';

export function AppearanceSettings() {
  return (
    <section className="settings-section" aria-labelledby="appearance-settings">
      <h3 id="appearance-settings">Appearance</h3>
      <AccentSwatchPicker />
      <p>The accent colour applies at once and is remembered.</p>
    </section>
  );
}
