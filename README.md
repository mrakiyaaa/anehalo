# Anehalo

A quiet place for your thoughts. Anehalo is a Windows desktop notes app built with Tauri 2, React, and strict TypeScript. Your notes are ordinary Markdown files in a folder you choose, with no account or cloud service.

## Features

- Folders, recent notes, quick capture, and recoverable trash.
- Rich text editing with headings, lists, checklists, tables, code, colors, images, and slash commands.
- `/page` links, automatic link rewriting on rename, backlinks, and navigation history.
- Full-text search with Sinhala/Tamil support and find within a note.
- Markdown/PDF export, image assets, and plain/rich clipboard copy.
- Light/dark/system themes, onboarding, remembered settings, global quick note and quick open, tray, and optional Windows autostart.
- Ordered atomic saves with conflict detection, retries, and save-before-close protection.

## Install

Download the Windows x64 NSIS installer from [GitHub Releases](https://github.com/mrakiyaaa/anehalo/releases), when a release is published. Run it as your normal Windows user; Anehalo installs per user without administrator access. Microsoft Edge WebView2 Runtime is required. The installer can bootstrap a missing runtime; organization policies may require IT assistance.

**The installer is unsigned. Windows SmartScreen may warn about an unrecognized app.** Verify the source and release checksum before choosing to run it.

Uninstall through Windows Settings → Apps → Installed apps. Uninstall preserves the notes folder, attachments, trash, and settings. Reinstalling reuses them. Back up your vault independently; power failure or forced termination can still discard text held only in memory.

## Development

Install Node.js 24 LTS, Rust stable, Microsoft C++ Build Tools, and the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
npm ci
npm run tauri dev
```

`npm run dev` previews the frontend; local files and native integrations require Tauri. Fonts are bundled locally. Notes default to Documents\Anehalo. Onboarding and Settings choose a **location**: picking `D:\Notes` creates or reuses `D:\Notes\Anehalo`. Picking an existing Anehalo folder, in any letter case, reuses it directly. The final path is shown before continuing; sibling files are never scanned or granted access. Drive roots and system/AppData locations are rejected. Windows settings are saved atomically in `%APPDATA%\me.lakshitha.anehalo\settings.json`. Logs rotate at 1 MB in `%LOCALAPPDATA%\me.lakshitha.anehalo\logs`, retaining three archives and recording event names/error codes, never note content.

Scanning is asynchronous and limited to 20,000 entries and 10 seconds. It skips dot-folders, links/junctions, and non-Markdown files; attachments and trash have separate managed handling. Preview scanning has an 8 MiB per-note limit and a 64 MiB text-memory budget. An invalid, missing, unreadable, or oversized saved vault opens recovery with Choose a folder again and Use the default folder. Older saved locations that are not named Anehalo require confirmation through recovery, including small legacy folders. Existing files are never automatically moved or renamed; choose a copied Anehalo folder to restore notes.

## Test

```powershell
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm audit
cargo audit --file src-tauri/Cargo.lock
```

Install cargo-audit once with `cargo install cargo-audit --locked`. Vitest covers storage failures, autosave concurrency, Markdown safety, link rewriting, search, export, and UI interactions. Line coverage must reach 85% independently for storage, autosave, link rewriting, search, and export. Read `coverage/index.html`.

For native E2E tests on Windows:

```powershell
npm run build:debug
npm run test:e2e
```

The harness launches the real debug executable, runs it with `ANEHALO_TEST_ROOT`, which makes the debug build enable WebView2 remote debugging on a free port (read from the test profile's `DevToolsActivePort` file), and connects Playwright over CDP. No Playwright browser download is needed. Use an interactive Windows desktop for native dialogs. Tests generate disposable folders under `~/.anehalo-qa/anehalo-e2e-*` with their own vault, settings, WebView profile, and logs using debug-only `ANEHALO_TEST_ROOT`. This avoids AppData, which the normal location validator rejects. Isolated native vault access is restricted to that test's root. Release builds contain no test-root override. Never point tests at a personal vault.

The suite covers onboarding finish/skip, files/trash, formatting/reload, page links/backlinks, image export through the native Save dialog, Sinhala search, theme restart, close-time saves, storage edge cases, axe checks in both themes, and a generated 2,000-note benchmark. Page objects own selectors. Reports/screenshots are in `playwright-report`; artifacts are in `test-results`. Run a subset with `npm run test:e2e -- e2e/workspace.spec.ts`.

Follow the [manual Windows checklist](docs/testing/manual-checklist.md) for hotkeys, tray, autostart, single instance, clean-machine install, disk-full behavior, and uninstall preservation. See [validation](docs/testing/validation.md) and the [security audit](docs/testing/security-audit.md) for evidence and remaining sign-off.

## Build and release

```powershell
npm run build:installer
node scripts/check-release-isolation.mjs
node scripts/verify-installer.mjs
```

Output: `src-tauri/target/qa/release/bundle/nsis/`. QA uses a separate Cargo directory so an existing development session can stay open. NSIS uses `currentUser` installation, Anehalo icons, version 0.1.0, and a pre-uninstall hook that overrides app-data deletion. Keep user data outside the installation directory.

```powershell
npm run version:bump -- 0.1.1
node scripts/check-version.mjs
```

The bump script synchronizes `package.json`, `Cargo.toml`, `tauri.conf.json`, and both lockfiles. Commit those with a changelog entry. GitHub Actions runs strict lint/typecheck, coverage, audits, Rust checks, native E2E, and the installer build on branch pushes and pull requests. Pushing a matching `v<version>` tag runs a separate release workflow that builds the installer and attaches it to a **draft** GitHub Release for manual testing and publishing; see [Releasing](docs/RELEASING.md). Once a release is published, installed copies find it themselves: they check shortly after start and every six hours (Settings → Updates), verify the update's signature, and install it after saving your notes. Releases need the updater signing key, and losing that key strands every installed copy, so read the warning in [Releasing](docs/RELEASING.md) first. Manual checks remain a separate release sign-off.

## Importing and exporting diagrams

**Import.** Use _Import diagram…_ on Home, in the sidebar, or _Import diagram here_ in a folder's menu, or drag files onto the Home screen. Anehalo imports `.excalidraw` files (from any Excalidraw version) and PNG or SVG images exported with **Embed scene**. Files are copied into the folder under their own name (a number is added if the name is taken); the originals are never changed. A file that is not a readable drawing is skipped and nothing is written for it, and one summary says what came in and why anything was left out. Files over 50 MB ask first. One imported file opens; several leave you where you are. Dropping a `.excalidraw` file onto an open note or diagram imports it too, but never loads it over the open drawing.

**Export.** The diagram header's **Export** button (or `Ctrl+Shift+E`) opens one popover: PNG or SVG, background, light or dark, scale (PNG, 1× to 3×), _Embed scene_ (so Anehalo or excalidraw.com can open the image as a drawing again), and _Selection only_ while something is selected. It can save a file, copy a PNG or the SVG markup to the clipboard, or save a copy as `.excalidraw` for sharing outside the vault (`Ctrl+Shift+S`). The last options are remembered. SVGs embed their fonts, so they look the same anywhere and need no network. A drawing too large for the chosen scale says so and suggests a lower one. Excalidraw's own export dialog and its browser download are switched off, so Export is the only way out.

## Shortcuts

| Shortcut                       | Action                                        |
| ------------------------------ | --------------------------------------------- |
| `Ctrl+Alt+N`                   | Global quick note; configurable in Settings   |
| `Ctrl+Alt+D`                   | Global new diagram; configurable in Settings  |
| `Ctrl+Alt+A`                   | Open/toggle Anehalo; configurable in Settings |
| `Ctrl+K`                       | Search all notes                              |
| `Ctrl+F`                       | Find in the current note                      |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | Bold / italic / underline                     |
| `Ctrl+Shift+S`                 | Strikethrough; on a diagram, save a copy      |
| `Ctrl+Shift+K` or `/page`      | Insert a page link                            |
| `Ctrl+Shift+C`                 | Copy as Markdown                              |
| `Ctrl+Shift+E`                 | Open Export (notes and diagrams)              |
| `Alt+Left` / `Alt+Right`       | Back / forward through notes and diagrams     |
| `Ctrl+`                        | Collapse or expand the sidebar                |
| `Ctrl+Z` / `Ctrl+Y`            | Undo / redo                                   |
| `Ctrl+Alt+1` / `2` / `3`       | Headings                                      |
| `Escape`                       | Close menu, search, or dialog                 |

Toolbar tooltips and slash commands show additional shortcuts. `Ctrl+K` always opens global search, on diagrams too, where it takes the place of Excalidraw's own Ctrl+K (add link); add a link to a shape from its context menu instead. While you type text inside a diagram, Anehalo's shortcuts stay quiet, because Ctrl+Alt is AltGr on many keyboard layouts. Excalidraw's other shortcuts work as usual.

Open Anehalo restores and focuses the last view without creating a note. If the window is already focused, it hides to the tray when Keep running in the tray is enabled, or minimizes otherwise. The global shortcuts work while the app is running and must all use different keys. If an older setting already uses `Ctrl+Alt+D`, New diagram starts on `Ctrl+Alt+Shift+D`. An older custom quick-note binding on `Ctrl+Alt+A` is preserved during migration; Open Anehalo then starts on `Ctrl+Alt+O`.

The installer creates Start menu and desktop shortcuts. To launch an action even when Anehalo is closed, create a Windows shortcut to `anehalo.exe --open`, `anehalo.exe --new-note` or `anehalo.exe --new-diagram`, then set its **Properties → Shortcut key**. `--open` shows the last view, and `--open <file>` opens a `.md` note or `.excalidraw` diagram inside your vault; `--new-note` and `--new-diagram` create one in the selected folder. A running instance receives the action; a cold start queues it until loading and onboarding complete. Launching without arguments opens the existing view. Left-clicking the tray icon toggles show/hide; its menu also has Open Anehalo, New quick note and New diagram.

## Folder layout

```text
src/app/             Entry point, providers, recovery screen
src/components/      Shared controls and application layout
src/features/        Editor, storage, search, links, export, settings, desktop services
src/store/           Workspace, navigation, and theme stores
src/styles/          Fonts, themes, and component styles
src/test/            Unit-test setup and helpers
src-tauri/src/       Native tray, scoped snapshots, export transactions, logging
src-tauri/installer/ NSIS hooks preserving user data
src-tauri/icons/     App and installer icons
e2e/pages/           Playwright page objects
e2e/support/         Launch, isolation, native dialog, and process helpers
scripts/             Build, version, and release checks
docs/testing/        Validation, audit, manual checklist
.github/workflows/   Windows quality gates (windows.yml), draft releases (release.yml)
```

Vault folders contain `.md` notes, `.attachments/` images, and `.trash/` recoverable deletions. `.anehalo-initialized` prevents starter notes from reappearing after deletion. Hidden entries, symbolic links, and junctions are excluded. Permanent note deletion is not exposed.

Notes use a schema-based Markdown editor; pasted HTML is sanitized. Standard Markdown stays portable. Underline/highlight and theme-aware colors/sizes use restricted semantic HTML. Untouched files retain their original bytes. Exports sanitize HTML, flatten internal links to readable labels, and copy Markdown images into `<file name>_assets/`. PDF output renders locally with bundled Sinhala/Tamil fonts.

See [CHANGELOG](CHANGELOG.md).
