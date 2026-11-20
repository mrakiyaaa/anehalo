import { describe, expect, it } from 'vitest';
import designStyles from '@/styles/globals.css?raw';
import type { Theme } from '@/types/theme';
import {
  accentIds,
  accentPalette,
  applyAccent,
  currentAccent,
  defaultAccent,
} from './accent-palette';

/** The page colours an accent sits on, read from globals.css so the test follows the design. */
function surfaces(theme: Theme): string[] {
  const block =
    theme === 'light'
      ? designStyles.slice(0, designStyles.indexOf(":root[data-theme='dark']"))
      : designStyles.slice(designStyles.indexOf(":root[data-theme='dark']"));
  return ['--bg', '--sidebar', '--surface'].map((token) => {
    const value = new RegExp(`${token}:\\s*(#[0-9a-f]{6});`, 'i').exec(block)?.[1];
    if (!value) throw new Error(`globals.css has no ${theme} ${token}`);
    return value;
  });
}

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio. */
function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const pairs = accentIds.flatMap((id) =>
  (['light', 'dark'] as const).map((theme) => ({
    id,
    theme,
    tokens: accentPalette[id].modes[theme],
  })),
);

describe('accent palette', () => {
  it('defaults to sky and defines every token for every accent and mode', () => {
    expect(defaultAccent).toBe('sky');
    expect(accentIds).toHaveLength(7);
    for (const { tokens } of pairs) {
      expect(tokens.soft).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.onSoft).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.strong).toMatch(/^#[0-9a-f]{6}$/);
      expect(tokens.tint).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.\d+\)$/);
    }
  });

  it.each(pairs)('$id $theme: text on the soft colour passes AA (4.5:1)', ({ tokens }) => {
    expect(contrast(tokens.onSoft, tokens.soft)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(pairs.filter(({ theme }) => theme === 'light'))(
    '$id light: the strong colour passes AA as link text on every light surface',
    ({ tokens }) => {
      for (const surface of surfaces('light'))
        expect(contrast(tokens.strong, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(pairs)(
    '$id $theme: focus rings and icons in the strong colour reach 3:1 on every surface',
    ({ theme, tokens }) => {
      for (const surface of surfaces(theme))
        expect(contrast(tokens.strong, surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it('writes both modes as variables on the root, so the theme can pick a set', () => {
    const root = document.createElement('div');
    applyAccent('mint', root);
    expect(root.dataset.accent).toBe('mint');
    expect(root.style.getPropertyValue('--accent-strong-light')).toBe(
      accentPalette.mint.modes.light.strong,
    );
    expect(root.style.getPropertyValue('--accent-on-soft-dark')).toBe('#0c0c0d');
    expect(currentAccent(root)).toBe('mint');
    root.dataset.accent = 'teal';
    expect(currentAccent(root)).toBe('sky');
  });
});
