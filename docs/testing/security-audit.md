# Security and dependency audit

Audit date: 2026-11-08. Rerun `npm audit` and `cargo audit --file src-tauri/Cargo.lock` before release; advisory databases change. Raw results: [npm](audit-npm.json), [Cargo](audit-rust.json).

## npm

The initial audit reported ten moderate entries, all caused by `minimatch` globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) in ESLint and typescript-eslint's development dependency graph. The override to `minimatch >=11.0.1` removes the vulnerable transitive version. Validate compatibility with the strict lint gate. No runtime npm vulnerabilities were reported. The final audit must remain clean.

## Rust

`cargo audit` reports zero security vulnerabilities and these informational findings. They are kept visible; no advisory is silently ignored.

| Package                | Advisory                                                                   | Disposition                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bincode 1.3.3          | [RUSTSEC-2025-0141](https://rustsec.org/advisories/RUSTSEC-2025-0141.html) | Unmaintained, used by the required persisted-scope plugin to retain user-selected vault grants. No compatible patched release. Keep the upstream plugin current; replace when upstream migrates. Local scope state is not note HTML or downloaded data. |
| proc-macro-error 1.0.4 | [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html) | Unmaintained, transitive GTK build macros for non-Windows targets. Absent from the Windows application dependency graph. Await upstream GTK migration.                                                                                                  |
| zbus_names 4.3.5       | [RUSTSEC-2026-0371](https://rustsec.org/advisories/RUSTSEC-2026-0371.html) | Unmaintained standalone crate, merged into zbus 6. Linux-only transitive desktop integration; absent from Windows. Updating it directly would break upstream APIs.                                                                                      |
| zvariant 5.15.1        | [RUSTSEC-2026-0370](https://rustsec.org/advisories/RUSTSEC-2026-0370.html) | Same upstream zbus 6 migration; non-Windows dependency.                                                                                                                                                                                                 |
| zvariant_derive 5.15.1 | [RUSTSEC-2026-0372](https://rustsec.org/advisories/RUSTSEC-2026-0372.html) | Same upstream zbus 6 migration; non-Windows build dependency.                                                                                                                                                                                           |
| glib 0.18.5            | [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) | Unsound variant iterator implementation fixed in glib 0.20. The GTK/WebKit dependency chain requires 0.18, so direct replacement is incompatible. Not compiled into the Windows installer. Do not claim Linux release validation.                       |

Use `cargo tree --target x86_64-pc-windows-msvc` to inspect the shipped graph. Maintenance findings are accepted upstream constraints for this Windows package; actual vulnerabilities fail CI.

## Rendering and capabilities

Notes enter TipTap's schema-based Markdown parser, not a raw HTML insertion path. Clipboard HTML passes through DOMPurify with explicit allowed tags/attributes. Export HTML is built from the same schema, with escaped text and restricted image references, then sanitized before its print container. Existing injection regressions cover scripts, event handlers, unsafe URLs, styles, and arbitrary pasted HTML. Review `sanitize-editor-html.ts`, `buildPrintHtml.ts`, and their tests when changing the schema.

The CSP forbids eval, inline scripts, objects, frames, foreign base URLs, and form submission. Local bundled fonts/scripts/workers are allowed. Inline styles support TipTap, Radix positioning, and exported formatting. HTTP(S) images and image downloads remain allowed because remote images are an existing feature; local file images require the scoped asset protocol.

Capabilities grant only the window operations, event listeners, filesystem operations, dialogs, clipboard writes, file reveal, global shortcut registration, autostart, and log writes used by the app. Generic `core:default` and `core:path:default` were replaced with individual commands. `fs:allow-stat` is required to check native image-picker file sizes; `core:window:allow-is-maximized` is required to read title-bar state. Filesystem grants are limited to the default vault, exact settings file/internal temporary files, and user-selected paths restored by persisted-scope. No shell/HTTP plugin, arbitrary external opening, clipboard read, or global filesystem grant is installed.

The environment override is compiled only under `cfg(debug_assertions)`. Isolated tests keep vault/settings/WebView/logs/scopes in their temporary root and skip host autostart changes. Release binaries must contain no `ANEHALO_TEST_ROOT` string. The release isolation check enforces this.
