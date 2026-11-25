# Anehalo: working agreement

Read this first in every session, on any machine. It is the source of truth for how work on
Anehalo is planned, checked and shipped.

Anehalo is an offline Windows desktop app for local notes (`.md`) and diagrams (`.excalidraw`):
Tauri 2 (Rust), React + TypeScript + Vite, Tailwind v4, shadcn/ui, Zustand, TipTap, and an
embedded, lazily loaded Excalidraw. Tests: Vitest + Testing Library, Playwright E2E against the
real app through WebView2, and `cargo test`.

## Current status

v0.2.0 is in progress. Branches: only `master` and `develop`. Work happens on `develop` (keep it
merged up with `master`); `master` takes `develop` when CI is green. No per-task branches.

| Phase | Scope                                                  | State              |
| ----- | ------------------------------------------------------ | ------------------ |
| 0–4   | Stabilize, offline Excalidraw, storage, screen, Home   | Done, merged       |
| 5     | Notes ↔ diagrams: links, embeds, backlinks, safe links | Done, on `master`  |
| 6     | Search inside diagrams                                 | Done, on `master`  |
| 7     | Import / export                                        | Done, on `master`  |
| 8     | Libraries / templates                                  | Next (Milestone C) |
| 9     | Polish + release                                       | To do (release PR) |

Milestone B (Phases 5–7) is on `master`.

Phase 5 notes:

- PR #4 was merged with red CI. Lint failed first, which hid a data-loss bug: `DiagramEmbed`
  outranked the paragraph and became TipTap's default block, so replacing a note's text saved
  `""`. It is fixed, with a regression test in `diagram-markdown.test.ts` and an E2E test.
- `tauri-plugin-opener` runs with `open_js_links_on_click(false)`. Its injected click handler
  would otherwise send `_blank` links to the browser, around `on_new_window` and `openWebLink`.
- New E2E spec: `e2e/note-diagram-links.spec.ts`.

Phase 6 notes:

- `DiagramContentScan` is the only reader of diagram files for indexing. It reads each file once
  per modified time and feeds both `NoteLinkIndex` and `SearchIndex`. In-app saves pass the
  in-memory scene through `DiagramContentScan.saved`. Do not add another diagram read loop.
- Diagram text comes from `extractDiagramSearchText` / `searchTextFromElements`
  (`src/features/search/diagram-search-text.ts`): plain JSON, no Excalidraw, run in the search
  worker. Text elements (`originalText`, else `text`; bound text points at its container) and
  named frames are indexed. Links and deleted elements are not.
- Note search results are pinned by `src/features/search/__snapshots__/note-search-baseline.json`.
  Prettier skips snapshot files so they stay byte-exact.
- Ctrl+F on a diagram is Excalidraw's built-in canvas search (text elements only). The note find
  bar only mounts in the note editor.
- Vault text reads use one native command, `read_vault_files`, which checks paths in Rust (no
  links, plain names, authorized root) and reads a batch per IPC call. Each IPC call costs
  3–5 ms in WebView2, so per-component checks from the web UI made one read cost about 19 ms.
  The background index for 500 diagrams went from about 9.7 s to about 1.5 s. The settings
  folder is not a vault, so it still reads through the file-system plugin.
- New E2E spec: `e2e/diagram-search.spec.ts`.

Phase 7 notes:

- Import: `DiagramImportService` (`src/features/diagram-import`) turns files into vault diagrams; the
  store action `importDiagramFiles` wraps it (one queued write per file, one tree refresh, one
  open for a single file). `readImportedDiagram` in `diagram-codec.ts` validates with Excalidraw's
  `parseDiagram` / `loadFromBlob`. A `.excalidraw` file is copied byte for byte; PNG/SVG scenes
  are restored and re-serialized. The file picker is a hidden `<input type=file>` (same `File`
  path as drag and drop, so no new fs scope). Drops: every file on Home; only `.excalidraw`
  files over a note or diagram, so images still insert and a drawing is never replaced.
- Export: `DiagramExportService` (`src/features/diagram-export`) maps options to Excalidraw
  parameters. The only Excalidraw calls are `diagramImageRenderer` in `thumbnail-renderer.ts`.
  `ExportButton` and `use-export-keys` are shared with notes. One path: the header popover.
  `DiagramCanvas` closes Excalidraw's own `imageExport`/`jsonExport` dialogs and hands over;
  `excalidraw-environment.ts` makes `showSaveFilePicker` reject with `AbortError`, so Excalidraw's
  save-to-disk can never open a picker or download (Ctrl+Shift+S saves a copy instead).
- Clipboard images use the Tauri plugin's `writeImage` with PNG bytes (tauri feature
  `image-png`); the WebView clipboard needs focus and a permission prompt. Permission:
  `clipboard-manager:allow-write-image`. `write_note_export` now also allows `png`, `svg` and
  `excalidraw`.
- SVG fonts: Excalidraw subsets fonts with WebAssembly that needs `eval`, which the CSP refuses,
  so every export logged errors. `vite.config.ts` swaps its two subset chunks for pass-through
  stubs (`font-subset-*-stub.ts`): whole font files (split by unicode range) are embedded.
  `scripts/check-startup-chunks.mjs` fails if the real subsetting code ships again.
- WebView2 158 refuses `unload` listeners and logs a permissions-policy violation, which fails
  every E2E test (no console errors allowed). Excalidraw's canvas registered one; `vite.config.ts`
  switches it to `pagehide` and fails the build if Excalidraw changes that code.
- `save-dialog.ps1` waits for the dialog's File name box before typing, and checks the dialog
  closed. Typing blind on a slow CI runner left the dialog open with an error box on top.
- New E2E specs: `e2e/diagram-import.spec.ts`, `e2e/diagram-export.spec.ts`. `save-dialog.ps1`
  takes the dialog title; `clipboard-image.ps1` reads the clipboard as another app would.

## Workflow

- **Milestones:** B = Phases 5, 6, 7 (one PR after Phase 7). C = Phases 8, 9 (the release PR).
- **Each phase:** run lint, typecheck, format, unit/component tests, and only the E2E specs added
  or changed in that phase. Commit, then push the branch as a backup. No PR, and no waiting for CI.
- **Milestone end:** full E2E suite, all local checks, CI green, then ONE PR to `master`. Never
  merge with failing checks.
- **Risky phases:** plan first. When asked, wait for approval before changing code.

Local checks, in CI order (CI: `.github/workflows/windows.yml`):

```sh
npm ci
node scripts/check-version.mjs
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm audit --omit=dev
node scripts/check-npm-audit.mjs
cargo audit --file src-tauri/Cargo.lock
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:debug
node scripts/check-startup-chunks.mjs
npm run test:e2e -- --grep-invert @startup-budget   # full suite; or name the phase's specs
npm run test:e2e -- --grep @startup-budget
```

Set `CARGO_TARGET_DIR=src-tauri/target/qa` as CI does. E2E runs against the debug build, so
rebuild after any frontend or Rust change.

## Clean coding rules

- Meaningful names, single responsibility, DRY, and a clear structure that follows the existing
  conventions.
- Only `DiagramCanvas`, the diagram repository layer (`DiagramRepository` and its
  `diagram-codec`), and the thumbnail renderer import `@excalidraw/excalidraw` at runtime.
  Type-only imports are fine anywhere. Excalidraw must never load at startup
  (`scripts/check-startup-chunks.mjs` enforces this).
- Minimal comments: only explain _why_.
- Strict TypeScript: no `any`, no `@ts-ignore`, no unguarded non-null `!`.
- Explicit error handling: typed errors, user-facing messages, logging through the existing file
  logger (`logFailure`), and no silent `catch {}`.
- Rust: no `unwrap()` / `expect()` in command paths.
- Tests: every fix has a test that fails before it and passes after it. No fixed sleeps. Never
  delete, skip or weaken a test. Never disable a lint rule to get past it.
