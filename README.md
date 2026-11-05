# Anehalo

A minimal desktop note-taking app built with Tauri 2, React, TypeScript, and Vite. Notes are real Markdown files in a local vault. The visual references are the approved [home screen](docs/design/anehalo-home.html) and [onboarding](docs/design/anehalo-onboarding.html).

## Run

Install Node.js 24 LTS, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system. Windows requires the Microsoft C++ Build Tools and WebView2.

```sh
npm ci
npm run tauri dev     # Desktop app
npm run dev           # Frontend preview; vault access requires the desktop app
```

```sh
npm run build         # Strict TypeScript checks and frontend production build
npm run tauri build   # Native release build and installers
npm run lint
npm run format
npm run format:check
npm run test          # Vitest + React Testing Library, single run
npm run test:watch
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

## Structure

- `src/app`: app entry, providers, and interaction tests.
- `src/components`: shadcn/ui primitives and small layout components.
- `src/features`: storage repositories, note filtering, folders, capture, and themes.
- `src/lib`: shared utilities and constants.
- `src/store`: Zustand stores.
- `src/styles`: Tailwind v4, shadcn/ui tokens, and pastel palettes.
- `src/types`: shared TypeScript types.
- `src/test`: test setup and automatic cleanup.
- `src-tauri`: native configuration, plugins, and capabilities.

The `@/` alias resolves to `src/`. shadcn/ui uses CSS variables and the New York style. Shared controls use Radix for accessible menus and in-app dialogs. `main.tsx` injects settings, folder access, and a note-repository factory; UI and stores consume interfaces. Tests inject in-memory repositories, sharing the real settings parsing and storage validation, initialization, atomic-write, and trash logic through filesystem ports.

Fredoka and Figtree variable fonts are bundled locally. Settings hold the theme preference, which defaults to Match my PC. The system theme is followed until the user chooses light or dark. A localStorage mirror under `anehalo-theme` applies the choice before first paint; settings synchronize it at startup. Root `data-theme` drives CSS tokens and Tailwind's `dark:` variant. The Motion switch uses a circular View Transition reveal, with a soft color fade for unsupported browsers or reduced motion. Storage failures keep the session usable and display a notice.

The 44px custom title bar supports native dragging, minimize, maximize/restore, and close through scoped Tauri window permissions. The shell has a 272px sidebar, scrollable home panel, and 34px status bar, with a minimum native window size of 900×600.

First launch shows five onboarding steps and a summary. The optional name, notes folder, theme, and completion flag are saved atomically to `settings.json` in Tauri's app config directory (`%APPDATA%/me.lakshitha.anehalo` on Windows). Missing or corrupt settings restart setup with defaults. Skip resets all answers to defaults; both flows save only when Open Anehalo is pressed. Delete `settings.json` while the app is closed to test first launch again.

The default vault is Documents/Anehalo, resolved with Tauri's path API. The native folder picker can select a custom vault; a temporary write-and-remove check verifies access, and the persisted-scope plugin restores that grant on restart. Completing onboarding prepares the vault and adds `Getting started/Welcome.md` if empty. A hidden initialization marker prevents reseeding after deletion. Existing notes stay intact. Directories become folders; `.md` files, including files at the root, become notes identified by vault-relative paths. Hidden directories and links are excluded. Search includes full plain text, and notes are sorted by modification time.

Quick note, the capture card, and `Ctrl+Alt+N` create an `Untitled note.md` in the selected folder (or vault root) and open the focused TipTap editor. Click a note card or sidebar note to open an existing file. The editable title renames the file, sanitizing Windows names and suffixing duplicates. The editor supports basic Markdown headings, bold, italic, lists, quotes, code, and links; formatting tools come in Phase 4. The last opened note is restored on launch; `reopenLastNote` in settings can disable this.

`NoteAutoSaver` owns debounce, serialization of writes, and retries independently of React. Changes save after 500ms, on blur, before switching notes or going home, and before closing. Closing waits for notes and settings to finish saving. Failed writes retry with backoff up to 30 seconds; unsaved drafts remain accessible in the sidebar. Unchanged notes are never rewritten, preserving their exact original Markdown and line endings. Returning focus reloads clean files changed externally. Dirty conflicts offer Keep mine / Load theirs; deleted or renamed files retain unsaved text and can be recovered as a new note.

New folder opens an inline name field. Use an item's `…` button or right-click to rename it or move it to trash after an in-app confirmation. Regaining window focus reloads the vault tree.

Writes use exclusive temporary siblings followed by rename. Names are Windows-safe, limited to 80 Unicode characters, and duplicate creations receive numeric suffixes. Colliding renames are rejected. Static filesystem permissions cover `$DOCUMENT/Anehalo`, the settings file, and its temporary siblings. Custom vault grants come from the native folder picker. Repository validation also rejects traversal, hidden-item access, symbolic links, and junctions.

Deleted items retain their original relative path beneath `.trash/<timestamp-identifier>/`. To recover one, move it from that entry back to its original location in the vault, then refocus Anehalo. Deleting a folder moves all of its contents together. No note or folder is permanently removed by the UI. Filesystem failures return typed results and appear in the UI with retry controls.
