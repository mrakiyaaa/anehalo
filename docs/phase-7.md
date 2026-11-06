# Phase 7: search and desktop integration

Search is owned by `SearchIndex`, with a `SearchEngine` interface and a repository decorator that observes successful writes, creates, renames, and deletes. Refreshes reconcile files changed outside Anehalo on window focus. Reads yield between notes; Markdown parsing, Unicode normalization, and snippet extraction run in a worker. Concurrent saves and deletes take precedence over older scans. The index retains plain text and note metadata.

Normalization preserves Sinhala and Tamil vowel signs and canonical equivalence while ignoring optional accents in Latin and other accented scripts. Snippets render React text nodes with `<mark>` elements. Find decorations are ProseMirror decorations, so they do not enter the document, auto-save, or exports.

`DesktopRuntime` coordinates the existing quick-note action, settings persistence, save-before-hide/quit, and the one-time tray notice through `GlobalShortcutService` and `TrayService`. Native implementations contain the Tauri calls; fakes support tests. Shortcut changes register the replacement before releasing the old shortcut. Ownership-aware cleanup prevents a previous vault from unregistering the new vault's shortcut.

Rust registers the single-instance, global-shortcut, and autostart plugins and builds the tray with the app icon. Autostart passes `--autostart` and leaves the window hidden. The tray dispatches note, settings, and quit actions to TypeScript so saves complete before exit.

Settings migrate older files with defaults, retain the existing settings repository, and apply immediately. Folder switching uses the onboarding picker and writable check, requests confirmation in the app, saves the current vault, and opens the chosen vault without moving files.

## Keyboard

- Ctrl+K: search all notes. Arrow keys select, Enter opens, Escape closes.
- Ctrl+F: find in the open note. Enter/Shift+Enter move and wrap; Escape closes.
- Ctrl+Alt+N: default global quick note, configurable in Settings.
- Ctrl+Shift+K: the editor's existing link action, moved to make Ctrl+K available globally.

## Verification

- `npm run lint`
- `npm run test`: includes ranking, Unicode, worker processing/failures, index mutation/focus/race handling, safe snippets, find navigation, shortcut validation/conflicts/ownership, save ordering, tray notice, settings, and folder confirmation.
- `npm run build`
- Real Edge browser smoke check: light/dark Settings, worker searches for Sinhala and Tamil, snippet highlighting, Enter/editor focus, and Ctrl+F; no app console errors.
- Cargo dependency resolution and locked metadata checked. Native compilation and desktop smoke checks require the Windows Rust standard library and MSVC build tools, which are not installed in this workspace's environment.

## Windows desktop smoke checks

1. Launch the Tauri app. Focus another app, press Ctrl+Alt+N, and type into the newly created note. Repeat while Anehalo is minimized and hidden in the tray.
2. Close a dirty note with tray running enabled, reopen from the tray, and verify its content. Use tray Quit with a pending save, restart, and verify the content again. A failed save must keep the app available.
3. Launch the executable a second time; the existing window should open. Left-click the tray icon and check its four menu actions.
4. Occupy the configured shortcut in another app before launching Anehalo. Check the error message and change the shortcut through Settings. Restart to verify persistence.
5. Enable Start with Windows in an installed build and sign in again. Anehalo should start hidden, with its tray and global hotkey available. Disable the setting and verify the startup entry is removed.
