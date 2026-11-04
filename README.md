# Anehalo

A minimal desktop note-taking app built with Tauri 2, React, TypeScript, and Vite. Phase 2 stores notes as real Markdown files in a local vault. The visual reference is [the approved home screen](docs/design/anehalo-home.html).

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

The `@/` alias resolves to `src/`. shadcn/ui uses CSS variables and the New York style. Shared controls use Radix for accessible menus and in-app dialogs. `main.tsx` injects `TauriNoteRepository`; UI and stores consume only `NoteRepository`. Tests inject `InMemoryNoteRepository`, which shares the same validation, initialization, atomic-write, and trash logic through a filesystem port.

Fredoka and Figtree variable fonts are bundled locally. The theme defaults to the system setting and follows system changes until the user chooses light or dark. The choice is saved under `anehalo-theme` in localStorage and applied by a blocking head script before the app paints. Root `data-theme` drives CSS tokens and Tailwind's `dark:` variant. The Motion switch uses a circular View Transition reveal, with a soft color fade for unsupported browsers or reduced motion. Storage failures keep the session usable and display a notice.

The 44px custom title bar supports native dragging, minimize, maximize/restore, and close through scoped Tauri window permissions. The shell has a 272px sidebar, scrollable home panel, and 34px status bar, with a minimum native window size of 900×600.

The vault is created under the user's Documents directory using Tauri's path API. An empty first launch creates `Getting started/Welcome.md`; a hidden initialization marker prevents reseeding after deletion. Directories become folders; `.md` files, including files at the root, become notes identified by vault-relative paths. Hidden directories and links are excluded. Search includes full plain text, and notes are sorted by modification time.

Quick note and `Ctrl+Alt+N` create an `Untitled note.md` in the selected folder (or vault root). Capture saves after 700ms, on blur, and before closing; unsaved text is retained if saving fails. A full editor comes in Phase 3. New folder opens an inline name field. Use an item's `…` button or right-click to rename it or move it to trash after an in-app confirmation. Regaining window focus reloads external changes.

Writes use exclusive temporary siblings followed by rename. Names are Windows-safe, limited to 80 Unicode characters, and duplicate creations receive numeric suffixes. Colliding renames are rejected. The filesystem plugin is scoped only to `$DOCUMENT/Anehalo` and its descendants; repository validation also rejects traversal, hidden-item access, symbolic links, and junctions.

Deleted items retain their original relative path beneath `.trash/<timestamp-identifier>/`. To recover one, move it from that entry back to its original location in the vault, then refocus Anehalo. Deleting a folder moves all of its contents together. No note or folder is permanently removed by the UI. Filesystem failures return typed results and appear in the UI with retry controls.
