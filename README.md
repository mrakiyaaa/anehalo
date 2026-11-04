# Anehalo

A minimal desktop note-taking app built with Tauri 2, React, TypeScript, and Vite. This foundation contains an empty shell; note, folder, and editor features are intentionally unimplemented.

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

- `src/app`: app entry, providers, and shell smoke test.
- `src/components`: shadcn/ui primitives and small layout components.
- `src/features`: reserved notes, folders, editor, and theme modules.
- `src/lib`: shared utilities and constants.
- `src/store`: Zustand stores.
- `src/styles`: Tailwind v4, shadcn/ui tokens, and pastel palettes.
- `src/types`: shared TypeScript types.
- `src/test`: test setup and automatic cleanup.
- `src-tauri`: native configuration, plugins, and capabilities.

The `@/` alias resolves to `src/`. shadcn/ui uses `components.json`, CSS variables, and the New York style. Its Button primitive is available for future UI; no feature controls are rendered yet.

Fredoka and Figtree variable fonts are bundled locally. The default theme is light. `useThemeStore.getState().setTheme('dark')` updates `data-theme` on the document root through `ThemeProvider`; both CSS tokens and Tailwind's `dark:` variant follow that attribute. Motion respects the user's reduced motion preference.

The native window uses the operating system's window controls. Filesystem and global shortcut plugins are registered in Rust and enabled for the main window. Filesystem permissions use Tauri's app-directory defaults. Path APIs are built into Tauri 2 (`@tauri-apps/api/path`), initialized by Tauri core and enabled with [`core:path:default`](https://v2.tauri.app/reference/acl/core-permissions/#path); there is no separate path plugin. No files are written and no global shortcuts are bound at startup.
