# Startup profile

How long Anehalo takes from process spawn to a usable Home screen, split by stage, for a vault of 2,000 generated notes. The budgets in `e2e/support/startup-budgets.ts` are based on these numbers.

## How it is measured

- `e2e/performance.spec.ts` (tagged `@startup-budget`) launches the app 3 times on the same vault. Before each launch it deletes the WebView2 profile, so every launch is a first launch, like a fresh install. The budget compares the **median** of the 3 launches.
- Native stages come from the `startup_timeline` command (`src-tauri/src/startup_timeline.rs`). Page stages come from the marks in `src/features/diagnostics/startup-marks.ts`. Both use wall-clock time, so they line up with the harness's spawn time.
- The startup reporter (`e2e/support/startup-profile-reporter.ts`) prints the per-stage medians after each run. In CI it also adds them to the job summary and as a notice annotation.
- Two builds are measured:
  - **debug**: `npm run build:debug`.
  - **optimized**: `npm run build:e2e-optimized`. This uses the release compiler settings (LTO, `opt-level = 3`) plus debug assertions, because the isolated test root and the DevTools port only exist with them. Select it with `ANEHALO_E2E_BUILD=optimized`.

Reproduce locally:

```bash
npm run build:debug
npm run test:e2e -- --grep @startup-budget --repeat-each=2
npm run build:e2e-optimized
ANEHALO_E2E_BUILD=optimized npm run test:e2e -- --grep @startup-budget --repeat-each=2
```

## Results

Median per stage, in milliseconds. "Search index build" runs in the background after Home is usable, so it is not part of the total.

| Stage                                    | Local debug (6) | Local optimized (6) | CI debug (6) | CI optimized (6) |
| ---------------------------------------- | --------------: | ------------------: | -----------: | ---------------: |
| Process spawn to native entry            |             143 |                 113 |           31 |               27 |
| Plugin initialization                    |              21 |                  18 |            8 |                8 |
| Event loop, window and WebView2 creation |           1,140 |               1,057 |          725 |              493 |
| App setup hook (paths, tray)             |              21 |                  21 |            9 |                9 |
| Setup to page navigation                 |              21 |                  26 |          658 |              913 |
| Page load to app script running          |              85 |                  79 |           73 |               86 |
| Script to window shown                   |             130 |                 115 |          125 |              133 |
| Vault scan (titles and metadata)         |              36 |                  27 |           37 |               50 |
| Scan to first Home render                |             138 |                 150 |          107 |              103 |
| Search index build (background)          |           2,172 |               2,243 |        2,439 |            2,387 |
| **Total: spawn to Home usable**          |       **1,806** |           **1,682** |    **1,706** |        **1,828** |

Local: Windows 11 desktop, WebView2 157. CI: GitHub `windows-latest`, WebView2 156. Stage medians are taken separately, so they do not add up exactly to the total median.

## Findings

- **WebView2 startup is 65–80% of startup** on every machine and in both builds. Tauri creates the window, and with it the WebView2 browser process and a new profile, before the app's own code runs. Locally that cost lands in "window and WebView2 creation"; on CI part of it shows up as "setup to page navigation" instead, because WebView2 finishes starting after the setup hook. Together they are about 1.1 s locally and 1.4 s on CI. Compiler optimization barely changes it, because the time is spent inside WebView2.
- **The app's own work is about 400 ms**: loading and running the bundle, showing the window, a metadata-only vault scan (about 30 ms for 2,000 notes), and the first Home render.
- **No obvious waste was found in app code.** The first scan already reads titles and metadata only. Note bodies and the search index load in the background, and the scan yields to input in batches. The vault read waits about 45 ms after the window is shown, because it needs the vault path from settings; that is a real dependency.
- Launch-to-launch variance comes mostly from WebView2 creation and process start (disk and antivirus), which is why the budget uses a median.

## Budgets

| Build     | Budget (median of 3) | Why                                                                                                                  |
| --------- | -------------------: | -------------------------------------------------------------------------------------------------------------------- |
| Optimized |             2,000 ms | Product target. Do not raise it to make a check pass. CI median 1,828 ms, so the headroom on CI is small (about 9%). |
| Debug, CI |             2,500 ms | CI median 1,706 ms plus about 45% for runner variance; single CI launches reached about 2,200 ms.                    |
