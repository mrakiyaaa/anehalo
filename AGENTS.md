# Anehalo: working agreement

Read this first in every session, on any machine. It is the source of truth for how work on
Anehalo is planned, checked and shipped.

Anehalo is an offline Windows desktop app for local notes (`.md`) and diagrams (`.excalidraw`):
Tauri 2 (Rust), React + TypeScript + Vite, Tailwind v4, shadcn/ui, Zustand, TipTap, and an
embedded, lazily loaded Excalidraw. Tests: Vitest + Testing Library, Playwright E2E against the
real app through WebView2, and `cargo test`.

## Current status

v0.2.0 is in progress on `claude/anehalo-v0-2-milestone-b` (Milestone B).

| Phase | Scope                                                  | State                  |
| ----- | ------------------------------------------------------ | ---------------------- |
| 0–4   | Stabilize, offline Excalidraw, storage, screen, Home   | Done, merged           |
| 5     | Notes ↔ diagrams: links, embeds, backlinks, safe links | Done on the branch     |
| 6     | Search inside diagrams                                 | Next                   |
| 7     | Import / export                                        | To do (Milestone B PR) |
| 8     | Libraries / templates                                  | To do                  |
| 9     | Polish + release                                       | To do (release PR)     |

Phase 5 notes:

- PR #4 was merged with red CI. Lint failed first, which hid a data-loss bug: `DiagramEmbed`
  outranked the paragraph and became TipTap's default block, so replacing a note's text saved
  `""`. It is fixed, with a regression test in `diagram-markdown.test.ts` and an E2E test.
- `tauri-plugin-opener` runs with `open_js_links_on_click(false)`. Its injected click handler
  would otherwise send `_blank` links to the browser, around `on_new_window` and `openWebLink`.
- New E2E spec: `e2e/note-diagram-links.spec.ts`.

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
