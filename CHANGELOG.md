# Changelog

## 0.1.0 — 2026-11-08

First Windows release candidate. Local Markdown vaults, folders, recoverable trash, rich text editing and image attachments, page links and backlinks, Sinhala/Tamil-aware search, Markdown/PDF export, themes, onboarding, tray, autostart, and global quick-note shortcuts.

Phase 8 hardening adds service coverage gates, native WebView2 E2E tests, accessibility checks in both themes, isolated debug test directories, an error recovery screen, rotating private diagnostics, scoped native vault snapshots, large-vault list virtualization, a strict CSP, explicit capabilities, and per-user NSIS packaging. The uninstaller preserves notes and settings.

See [validation](docs/testing/validation.md) for measured results, bugs fixed, and remaining release sign-off. Installers are unsigned; Windows SmartScreen may warn.

Quick open adds a configurable Ctrl+Alt+A toggle that preserves the last view, independent quick-note and open shortcut bindings, queued --open/--new-note launch actions through the existing single-instance plugin, and tray left-click toggling. The installer creates both Start menu and desktop shortcuts. Existing quick-note bindings and behavior are preserved.
