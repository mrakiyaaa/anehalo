# Changelog

## Unreleased

Diagrams. Create Excalidraw diagrams next to your notes: from the sidebar's New diagram button, the Home card, a folder's "New diagram here", the tray menu, `Ctrl+Alt+D` from anywhere (configurable in Settings), or `anehalo.exe --new-diagram`. `--open <file>` opens a note or diagram in the vault. Diagrams are saved as `.excalidraw` files with the same auto-save, conflict and trash safety as notes. The diagram screen shares the note header: back and forward (Alt+Left/Right across notes and diagrams), Home, a title that renames the file, the folder and the save status. The sidebar lists notes and diagrams together under "All items", and diagrams can be renamed, moved, shown in File Explorer or moved to trash from their menu. An untouched new diagram is kept, as an untouched new note is.

Automatic updates. Anehalo checks GitHub Releases ten seconds after it starts and every six hours (Settings → Updates can turn this off or check on demand), and shows a small banner when a newer version is published. **Update now** saves all notes and settings, downloads the signed installer, verifies its signature, saves again, and installs for the current user before restarting. Nothing is checked or installed in development builds, and a failed check while offline is logged, not shown. Settings now reads the version from the running app.

Copies installed from 0.1.0 have no updater and must be reinstalled once from the first release that includes it.

## 0.1.0 — 2026-11-08

First Windows release candidate. Local Markdown vaults, folders, recoverable trash, rich text editing and image attachments, page links and backlinks, Sinhala/Tamil-aware search, Markdown/PDF export, themes, onboarding, tray, autostart, and global quick-note shortcuts.

Phase 8 hardening adds service coverage gates, native WebView2 E2E tests, accessibility checks in both themes, isolated debug test directories, an error recovery screen, rotating private diagnostics, scoped native vault snapshots, large-vault list virtualization, a strict CSP, explicit capabilities, and per-user NSIS packaging. The uninstaller preserves notes and settings.

See [validation](docs/testing/validation.md) for measured results, bugs fixed, and remaining release sign-off. Installers are unsigned; Windows SmartScreen may warn.

Quick open adds a configurable Ctrl+Alt+A toggle that preserves the last view, independent quick-note and open shortcut bindings, queued --open/--new-note launch actions through the existing single-instance plugin, and tray left-click toggling. The installer creates both Start menu and desktop shortcuts. Existing quick-note bindings and behavior are preserved.

Custom folder selection now creates or reuses an Anehalo child folder and grants access only to that vault. Legacy broad persisted grants are ignored; validated saved vaults regain access on restart. Bounded asynchronous scans, worker previews, typed location errors, and startup folder recovery prevent large parent directories or bad settings from freezing the app. Existing files are left in place.
