import type { E2eBuild } from './e2e-build';

export interface StartupBudget {
  /** Launches per check. A median of several ignores one-off spikes such as a disk stall. */
  readonly launches: number;
  /** The median spawn-to-usable-Home time, for a 2,000-note vault and a new WebView2 profile. */
  readonly medianMilliseconds: number;
}

export const startupBudgets: Readonly<Record<E2eBuild, StartupBudget>> = {
  // The product target. The optimized build uses release compiler settings, so it stands in
  // for what users install. Do not raise this to make a check pass; fix the regression.
  optimized: { launches: 3, medianMilliseconds: 2_000 },
  // Debug builds are unoptimized and CI runners are slower than desktops, so this budget comes
  // from measured CI medians plus a margin (see docs/testing/startup-profile.md). It still
  // fails on a real regression of that size.
  debug: { launches: 3, medianMilliseconds: 3_000 },
};
