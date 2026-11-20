import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAccentStore } from '@/store/accent-store';
import { accentPalette } from './accent-palette';
import { AccentSwatchPicker } from './AccentSwatchPicker';

function renderPicker() {
  // Reduced motion applies the colour without the fade, so the test needs no timers.
  render(
    <MotionConfig reducedMotion="always">
      <AccentSwatchPicker />
    </MotionConfig>,
  );
  return userEvent.setup();
}

beforeEach(() => useAccentStore.getState().setAccent('sky'));

describe('accent swatch picker', () => {
  it('shows seven named swatches with the current one selected', () => {
    renderPicker();
    const group = screen.getByRole('radiogroup', { name: 'Accent color' });
    const swatches = screen.getAllByRole('radio');
    expect(group).toContainElement(swatches[0] ?? null);
    expect(swatches.map((swatch) => swatch.getAttribute('aria-label'))).toEqual([
      'Accent color: Sky, selected',
      'Accent color: Blue',
      'Accent color: Mint',
      'Accent color: Peach',
      'Accent color: Lilac',
      'Accent color: Butter',
      'Accent color: Rose',
    ]);
    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(
      'Accent color: Sky, selected',
    );
  });

  it('applies a clicked colour at once', async () => {
    const user = renderPicker();
    await user.click(screen.getByRole('radio', { name: 'Accent color: Mint' }));
    expect(useAccentStore.getState().accent).toBe('mint');
    expect(document.documentElement.style.getPropertyValue('--accent-strong-light')).toBe(
      accentPalette.mint.modes.light.strong,
    );
    expect(screen.getByRole('radio', { name: 'Accent color: Mint, selected' })).toBeChecked();
  });

  it('moves with the arrow keys and picks with Enter', async () => {
    const user = renderPicker();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Accent color: Sky, selected' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Accent color: Mint' })).toHaveFocus();
    expect(useAccentStore.getState().accent).toBe('sky');
    await user.keyboard('{Enter}');
    expect(useAccentStore.getState().accent).toBe('mint');
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Accent color: Rose' })).toHaveFocus();
  });

  it('names each swatch in a tooltip', async () => {
    const user = renderPicker();
    await user.hover(screen.getByRole('radio', { name: 'Accent color: Lilac' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Lilac');
  });
});
