# Startup profile

How long Anehalo takes from process spawn to a usable Home screen, split by stage, for a vault of 2,000 generated notes and 500 diagrams. The budgets in `e2e/support/startup-budgets.ts` are based on these numbers.

## How it is measured

- `e2e/performance.spec.ts` (tagged `@startup-budget`) launches the app 6 times on the same vault:
  - **One first start**, with the WebView2 profile deleted beforehand, as right after installing. WebView2 then also creates its profile. This start is measured and reported, but not checked.
  - **Five normal starts**, which reuse that profile, as every start after the first does.
- Two medians are checked:
  - **Normal start:** spawn to usable Home, over the five normal starts.
  - **App time:** Anehalo's own share, from page load to usable Home, over all six starts.
- The earlier per-stage tables (below) used the first-start measurement for every launch.
- Native stages come from the `startup_timeline` command (`src-tauri/src/startup_timeline.rs`). Page stages come from the marks in `src/features/diagnostics/startup-marks.ts`. Both use wall-clock time, so they line up with the harness's spawn time.
- The startup reporter (`e2e/support/startup-profile-reporter.ts`) prints the per-stage medians after each run. In CI it also adds them to the job summary and as a notice annotation.
- Two builds are measured:
  - **debug**: `npm run build:debug`.
  - **optimized**: `npm run build:e2e-optimized`. This uses the release compiler settings (LTO, `opt-level = 3`) plus debug assertions, because the isolated test root and the DevTools port only exist with them. Select it with `ANEHALO_E2E_BUILD=optimized`.

Reproduce locally:

```bash
npm run build:debug
npm run test:e2e -- --grep @startup-budget
npm run build:e2e-optimized
ANEHALO_E2E_BUILD=optimized npm run test:e2e -- --grep @startup-budget
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

### Why the checks changed

Every startup check once measured a first start after installing, and the optimized build kept failing on CI at random. Across CI runs:

- WebView2 starting its browser process and creating a new profile took 1,230–1,870 ms, about 80% of the total. It swung by more than half a second between runs of identical code.
- Anehalo's own work stayed at 215–380 ms.
- The optimized-build median sat at about 1,750–1,850 ms against 2,000 ms. One failing run measured 3,596, 1,885 and 2,010 ms.

So pass or fail depended on the CI machine, not on Anehalo. The checks now measure what users experience on every start, plus the part Anehalo controls.

| Build     | Normal start (median of 5) | App time (median of 6) | Why                                                                                                                                                                   |
| --------- | -------------------------: | ---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimized |                   2,000 ms |                 600 ms | Product target. Do not raise it to make a check pass.                                                                                                                 |
| Debug     |                   2,500 ms |                 600 ms | The debug total keeps the margin set from CI data. App time is about 200–400 ms on CI, so 600 ms catches real regressions in Anehalo's code without failing on noise. |

The first start after installing is printed in the reporter's output and in the CI job summary, so a slowdown there remains visible.

### Background index build

The index build after first paint reads every note and diagram for search and links. It never blocks the window (its longest main-thread task is 0 ms), but diagram search and backlinks wait for it. Both builds check a median below 4,000 ms over the five normal starts.

Each diagram read used to cost about 19 ms. Profiling showed that every Tauri IPC call costs 3–5 ms in WebView2, whatever it does (even `path|join`), and one `readText` made 7 calls in a row: a path resolve, a join and an `lstat` per path component, then the read. The serial queue was not the cost: 50 reads in parallel still took about 2.5 ms each.

Text reads now go through one native command, `read_vault_files` (`src-tauri/src/vault_access.rs`), which applies the same checks in Rust next to the read: an authorized vault root, plain path names only, real directories on the way, and a regular file opened without following a final link. `DiagramContentScan` asks for 20 diagrams per call, and Rust stops a batch after 2 MB of content. Reads still run through the vault's operation queue.

| Search index build, median of 5 (2,000 notes, 500 diagrams) |   Before |    After |
| ----------------------------------------------------------- | -------: | -------: |
| Local debug                                                 | 9,717 ms | 1,396 ms |
| Local optimized                                             | 9,775 ms | 1,438 ms |
