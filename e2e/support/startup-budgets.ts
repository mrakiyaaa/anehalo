import type { E2eBuild } from './e2e-build';

export interface StartupBudget {
  /** Normal starts measured after the first one; a median of several ignores one-off spikes. */
  readonly warmLaunches: number;
  /** The median spawn-to-usable-Home time of a normal start, for 2,000 notes and 500 diagrams. */
  readonly warmMedianMilliseconds: number;
  /** The median time Anehalo's own code takes, from page load to usable Home, over all launches. */
  readonly appMedianMilliseconds: number;
}

// About 80% of a start is WebView2 launching its browser process, which Anehalo does not control
// and which swings by over half a second between CI runs. So the checks are:
// - the app's own time, which is stable (about 200-400 ms on CI), with room for real regressions;
// - the total of a normal start, which reuses the WebView2 profile as every start after the
//   first does. The very first start after installing also creates that profile; it is measured
//   and reported, but not checked, because on shared CI machines it is mostly noise.
// See docs/testing/startup-profile.md.
export const startupBudgets: Readonly<Record<E2eBuild, StartupBudget>> = {
  // The product target. The optimized build uses release compiler settings, so it stands in for
  // what users install. Do not raise this to make a check pass; fix the regression.
  optimized: { warmLaunches: 5, warmMedianMilliseconds: 2_000, appMedianMilliseconds: 600 },
  // Debug builds are unoptimized; their total budget keeps the margin set from CI data.
  debug: { warmLaunches: 5, warmMedianMilliseconds: 2_500, appMedianMilliseconds: 600 },
};
