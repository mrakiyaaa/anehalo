# Windows validation

Local Windows validation, 2026-11-08. The connected development app is kept separate from QA builds under `src-tauri/target/qa`.

| Gate                                               | Result                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ESLint, zero warnings                              | Passed                                                                                   |
| Strict TypeScript                                  | Passed                                                                                   |
| Vitest                                             | 437 tests passed in 41 files                                                             |
| Service line coverage                              | 94.07% overall; all five service groups exceed 85%                                       |
| Rust format / Clippy, zero warnings                | Passed                                                                                   |
| Rust tests                                         | 5 passed                                                                                 |
| Real Tauri / WebView2 E2E                          | 18 passed; retries disabled                                                              |
| axe                                                | No serious/critical violations on home, editor, search, or settings in either theme      |
| npm audit                                          | No vulnerabilities                                                                       |
| Cargo audit                                        | No vulnerabilities; six upstream informational findings documented in the security audit |
| NSIS / release isolation / uninstall source checks | Passed; no elevation requested; user-data deletion disabled by hook                      |

Coverage: storage 97.66%, autosave group 90.90%, link rewriter 100%, search 95.19%, export 91.26%. HTML/LCOV reports are generated under `coverage` and uploaded by CI.

## Automated commands

```powershell
npm ci
node scripts/check-version.mjs
npm run lint
npm run typecheck
npm run test:coverage
npm audit
cargo audit --file src-tauri/Cargo.lock
$env:CARGO_TARGET_DIR = 'src-tauri/target/qa'
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:debug
npm run test:e2e
npm run build:installer
node scripts/check-release-isolation.mjs
node scripts/verify-installer.mjs
```

The E2E fixture launches the **real debug executable** with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and connects using `chromium.connectOverCDP`. `ANEHALO_TEST_ROOT` supplies a fresh temporary root per test. That variable and its implementation are absent from release binaries. The root contains the vault, settings, and Tauri runtime state (WebView profile, logs, and scopes). Isolated runs skip host hotkey registration and autostart changes. Test teardown terminates only the process it spawned and removes only its own verified temporary directory. An occupied CDP port fails immediately instead of attaching to an unrelated app. No browser-only mock replaces the native filesystem.

Selectors live in the five page objects and fixture support. Markdown export uses Windows UI Automation and scoped native keystrokes to complete the real Save dialog on English Windows. No destination override bypasses user-selected export permissions. Playwright and axe reports are under `playwright-report`; unit coverage is under `coverage`. CI uploads them even after a failed gate. Native features and clean-machine installation require the [manual checklist](manual-checklist.md).

## Performance method

The benchmark generates 2,000 notes of roughly 1.3 KB each, launches an isolated app, waits until Quick note is enabled, queries a unique token, then takes five query samples. Startup runs from process creation to the React layout commit that makes the workspace usable; the later Playwright observation time is recorded separately so assertion polling does not inflate app startup. Search latency runs from the browser's input event until the result list clears `aria-busy`, including debounce, worker processing, and rendering. JavaScript heap is measured over CDP. Aggregate working set sums the app and descendant WebView2 processes, counting shared pages more than once. These are local measurements, not universal hardware guarantees.

The original sequential loader did not enable Quick note within 10 seconds. Startup now publishes a native metadata snapshot first, then loads bodies, previews, and indexes in the background. This removes per-file IPC round trips and lets the workspace become usable without waiting for every body. Search samples follow the first completed query so they measure the populated index. Concurrent saves, creates, renames, and deletes take precedence over background summaries. Large lists render only visible rows. Live note reads still go to disk so external edits are checked before saves. Search yields based on elapsed CPU time rather than inserting a timer after every 50 notes.

Final measurements on Windows 11 Pro 26200, Intel Core i5-1235U (12 logical processors), 16 GB RAM:

| Measurement                                    | Result       | Target                          |
| ---------------------------------------------- | ------------ | ------------------------------- |
| Usable workspace after process launch          | 847 ms       | <2,000 ms                       |
| Playwright observation of the usable workspace | 1,977 ms     | Diagnostic only                 |
| Search, five samples                           | 31.2–34.8 ms | <100 ms                         |
| JavaScript heap after search                   | 44.50 MiB    | Measured                        |
| Aggregate working set, eight processes         | 660.79 MiB   | Measured; includes shared pages |

The full native E2E run passed in about 65 seconds. [Raw performance measurements](performance.json) include resource timings. Debug application code uses optimization level 1 so debug IPC serialization does not dominate the benchmark; debug assertions and isolation remain enabled. The release profile remains optimized with LTO.

## Bugs found and fixed

- **Title edits lost during editor initialization:** TipTap schedules focus in a later animation frame. Checking focus before that frame could still interrupt a title fill and reset it to Untitled note. Automatic focus now checks the active field in the frame that applies focus; a deterministic regression changes focus between scheduling and execution.
- **Slow large-vault startup:** The old loader made sequential IPC filesystem calls and rendered every note's controls. A scoped native snapshot publishes metadata before reading bodies with bounded concurrency; indexes reuse those bodies, large lists are virtualized, and snippet extraction stops after its preview limit. Regression tests verify that late previews never overwrite a concurrent save and indexing reads the current file when a save supersedes the snapshot. Live save-conflict reads continue to use disk.
- **PDF code loaded at startup:** A generated preload helper shared the PDF chunk, bringing the PDF engine into the initial page even though export was lazy. The helper now has its own small chunk. All production JavaScript chunks are below the build warning threshold.
- **Avoidable search delay:** Timer yields after every 50 notes and a 70 ms debounce exceeded the desired latency. Yielding now follows elapsed work, with a shorter debounce.
- **Accessibility failures:** Light-theme secondary text and shortcut hints lacked contrast; folder counts and quick capture had mismatched accessible names; search options nested interactive buttons. Both themes now pass axe's serious/critical gate across all four requested screens.
- **Clipboard selection loss:** The browser fallback restored selection before refocusing the previous control, which could clear it. It now restores focus first, then the saved selection.
- **Missing vault silently recreated on first file operation:** Snapshot loading could leave the underlying filesystem uninitialized. The note adapter now refuses to create a missing root, retaining a recoverable missing-folder error.
- **Disk-full errors were generic:** Saves now return a typed `disk-full` error with a clear recovery message; tests verify original bytes and dirty drafts survive failures during both temporary write and rename.
- **Flaky tests:** Debounced-search assertions now wait for the current results; editor integration tests have realistic time budgets with fewer workers. E2E filesystem checks tolerate a file not yet existing during autosave, and native dialog handling runs concurrently with the blocked native action. Retries remain disabled.
- **Dependency vulnerability:** The vulnerable development-only minimatch dependency was replaced. The strict lint gate validates its compatibility.

Additional hardening: friendly React recovery, private rotating file logs, CSP, explicit permissions, debug-only test isolation, synchronized versions, and CI/release packaging. The generated NSIS uninstaller invokes the preservation hook before app-data deletion; that hook resets the deletion checkbox state to zero even if selected. The release binary contains no test-root override.

## Quick-open regression checks

Vitest fakes cover hidden, minimized, unfocused, and focused window states with both tray preferences; editor/view preservation; serialized rapid toggles; save-before-hide ordering and failure recovery; independent shortcut callbacks; internal conflicts after modifier normalization; settings rollback; and restoration of both bindings after a partial unregister failure. A migration regression preserves a pre-existing quick-note shortcut on Ctrl+Alt+A. Settings integration tests record and reset Open Anehalo and show duplicate-key feedback.

The argument parser covers --open, --new-note, unknown/ambiguous arguments, no arguments, and the existing --autostart action. Tests deliver pending and forwarded requests through the native event adapter, including a workspace-listener handoff and startup racing remembered-note restoration. Native E2E launches the debug executable with --new-note and --open and checks the note files. Host-global registration and real second-process single-instance delivery remain manual: isolated E2E skips those integrations to avoid changing the connected development app. NSIS source checks verify Start menu creation and the post-install desktop-shortcut hook; actual installation is still a manual check.

## Release status

The unsigned x64 NSIS artifact is `src-tauri/target/qa/release/bundle/nsis/Anehalo_0.1.0_x64-setup.exe` (4,593,351 bytes). SHA-256: `fab6887c38850383c01dbd9e2b66255a042c2eaccac0694823a843479462f641`. A matching `.sha256` file is generated beside it.

Clean-machine install, interactive/silent uninstall preservation, native tray/hotkey/autostart/single-instance checks, and GitHub-hosted CI remain **unverified**. No clean VM or Windows Sandbox executable is available in this workspace; the existing app's data was not used for an installation experiment. The [manual checklist](manual-checklist.md) is deliberately unsigned. The local working tree cannot prove a GitHub workflow run is green; the workflow will run after a push. No push or release publication was performed.
