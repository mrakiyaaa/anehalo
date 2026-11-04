# Anehalo

A minimal desktop note-taking app built with Tauri 2, React, TypeScript, and Vite. Phase 1 implements the home shell and theme system against typed mock data. The visual reference is [the approved home screen](docs/design/anehalo-home.html).

## Run

Install Node.js 24 LTS, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system. Windows requires the Microsoft C++ Build Tools and WebView2.

```sh
npm ci
npm run tauri dev     # Desktop app
npm run dev           # Frontend in a browser: http://localhost:1420
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
- `src/features`: note filtering, folder navigation, visual capture, and theme modules.
- `src/lib`: shared utilities and constants.
- `src/store`: Zustand stores.
- `src/styles`: Tailwind v4, shadcn/ui tokens, and pastel palettes.
- `src/types`: shared TypeScript types.
- `src/test`: test setup and automatic cleanup.
- `src-tauri`: native configuration, plugins, and capabilities.

The `@/` alias resolves to `src/`. shadcn/ui uses `components.json`, CSS variables, and the New York style. Shared buttons, icons, and icon badges support the shell. All sample folders, notes, and workspace details live in `src/lib/mock-data.ts`; Zustand stores only UI state and theme preferences.

Fredoka and Figtree variable fonts are bundled locally. The theme defaults to the system setting and follows system changes until the user chooses light or dark. The choice is saved under `anehalo-theme` in localStorage and applied by a blocking head script before the app paints. Root `data-theme` drives CSS tokens and Tailwind's `dark:` variant. The Motion switch uses a circular View Transition reveal, with a soft color fade for unsupported browsers or reduced motion. Storage failures keep the session usable and display a notice.

The 44px custom title bar supports native dragging, minimize, maximize/restore, and close through scoped Tauri window permissions. The shell has a 272px sidebar, scrollable home panel, and 34px status bar, with a minimum native window size of 900×600.

Folders and search filter the mock notes. Quick note and the in-window `Ctrl+Alt+N` shortcut focus capture. Capture displays saving feedback only: its text is held in component memory and does not create or save notes. New folder is a disabled placeholder. The storage path and markdown status are design placeholders; no filesystem access occurs.

Filesystem and global shortcut plugins remain registered for future phases. Path APIs are built into Tauri 2 (`@tauri-apps/api/path`) and enabled with [`core:path:default`](https://v2.tauri.app/reference/acl/core-permissions/#path). No global shortcuts are registered.
