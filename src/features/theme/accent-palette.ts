import type { Theme } from '@/types/theme';

export const accentIds = ['sky', 'blue', 'mint', 'peach', 'lilac', 'butter', 'rose'] as const;
export type AccentId = (typeof accentIds)[number];
export const defaultAccent: AccentId = 'sky';

export interface AccentTokens {
  /** Filled buttons and selected items. */
  readonly soft: string;
  /** Text and icons on `soft`. */
  readonly onSoft: string;
  /** Links, focus rings, icons, active borders and the save badge. */
  readonly strong: string;
  /** Subtle hover and selected backgrounds. */
  readonly tint: string;
}

export interface Accent {
  readonly id: AccentId;
  readonly name: string;
  readonly modes: Readonly<Record<Theme, AccentTokens>>;
}

/** Text on dark-mode filled buttons, which use the accent's strong colour as background. */
const darkOnSoft = '#0c0c0d';

function translucent(hex: string, alpha: number): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}

/**
 * The light strong colours are darker than first proposed where they fell short of 4.5:1 as
 * link text on the sidebar (#EDF0FB); hues are unchanged. accent-palette.test.ts checks every
 * pairing against WCAG AA.
 */
function accent(
  id: AccentId,
  name: string,
  light: { soft: string; strong: string; onSoft: string },
  darkStrong: string,
): Accent {
  return {
    id,
    name,
    modes: {
      light: { ...light, tint: translucent(light.strong, 0.1) },
      dark: {
        soft: darkStrong,
        onSoft: darkOnSoft,
        strong: darkStrong,
        tint: translucent(darkStrong, 0.16),
      },
    },
  };
}

export const accentPalette: Readonly<Record<AccentId, Accent>> = {
  sky: accent('sky', 'Sky', { soft: '#cfe6ff', strong: '#236dc5', onSoft: '#0f3d73' }, '#8cc4ff'),
  blue: accent(
    'blue',
    'Blue',
    { soft: '#d6e2ff', strong: '#2161ef', onSoft: '#14306e' },
    '#7ba3ff',
  ),
  mint: accent(
    'mint',
    'Mint',
    { soft: '#cdefe0', strong: '#1c7b57', onSoft: '#0d4a33' },
    '#6fd6a8',
  ),
  peach: accent(
    'peach',
    'Peach',
    { soft: '#ffe0cc', strong: '#b0521c', onSoft: '#6e2e0a' },
    '#ffb085',
  ),
  lilac: accent(
    'lilac',
    'Lilac',
    { soft: '#e4dbff', strong: '#6f4fd1', onSoft: '#35206e' },
    '#b9a3ff',
  ),
  butter: accent(
    'butter',
    'Butter',
    { soft: '#fff1bf', strong: '#876800', onSoft: '#5c4400' },
    '#f2d36b',
  ),
  rose: accent(
    'rose',
    'Rose',
    { soft: '#ffd9e3', strong: '#c53760', onSoft: '#6e1631' },
    '#ff9db8',
  ),
};

/** The accent the page currently shows, for code that needs its colours as values (PDF export). */
export function currentAccent(root: HTMLElement = document.documentElement): AccentId {
  const id = root.dataset.accent;
  return isAccentId(id) ? id : defaultAccent;
}

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && (accentIds as readonly string[]).includes(value);
}

const themes: readonly Theme[] = ['light', 'dark'];
const tokenKeys: readonly (keyof AccentTokens)[] = ['soft', 'onSoft', 'strong', 'tint'];
const tokenNames: Readonly<Record<keyof AccentTokens, string>> = {
  soft: 'soft',
  onSoft: 'on-soft',
  strong: 'strong',
  tint: 'tint',
};

/**
 * Writes the accent for both modes as CSS variables on the root element; globals.css picks the
 * set for the current theme, so switching theme needs no script.
 */
export function applyAccent(id: AccentId, root: HTMLElement = document.documentElement) {
  root.dataset.accent = id;
  for (const mode of themes)
    for (const token of tokenKeys)
      root.style.setProperty(
        `--accent-${tokenNames[token]}-${mode}`,
        accentPalette[id].modes[mode][token],
      );
}
