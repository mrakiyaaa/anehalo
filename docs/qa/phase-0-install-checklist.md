# Phase 0 — clean-install checklist

Manual test of the NSIS installer on a fresh Windows user account. Automated tests run against a debug build in an isolated folder, so they cannot prove anything on this list. An unchecked box means **not tested**, not passed.

## Setup

- Use a Windows 10 or 11 VM (or spare PC) and create a **new standard (non-administrator) local user**. Sign in as that user for every step.
- Download the installer from the draft GitHub Release (`Anehalo-Setup.exe`), or use `src-tauri/target/qa/release/bundle/nsis/Anehalo_<version>_x64-setup.exe` from a local `npm run build:installer`.
- Record the details below before you start.

| Item                     | Value |
| ------------------------ | ----- |
| Tester / date            |       |
| Windows edition / build  |       |
| WebView2 Runtime version |       |
| Installer file name      |       |
| Installer SHA-256        |       |
| App version (About)      |       |

Get the hash with PowerShell: `Get-FileHash .\Anehalo-Setup.exe -Algorithm SHA256`.

Use only throwaway notes. Paths below:

- **Install folder:** `%LOCALAPPDATA%\Anehalo`
- **Settings:** `%APPDATA%\me.lakshitha.anehalo`
- **Logs and WebView data:** `%LOCALAPPDATA%\me.lakshitha.anehalo`
- **Default vault:** `%USERPROFILE%\Documents\Anehalo`

## 1. Install without admin rights

- [ ] Double-click the installer. **Expect:** no UAC (administrator) prompt at any point.
- [ ] Finish the installer. **Expect:** files in `%LOCALAPPDATA%\Anehalo`, nothing in `C:\Program Files`.
- [ ] **Expect:** a Start menu entry and a desktop shortcut, both with the Anehalo icon.
- [ ] Open **Settings → Apps → Installed apps**. **Expect:** "Anehalo" with the correct version and publisher "Lakshitha".
- [ ] If WebView2 is missing (rare on Windows 11), note whether the installer fetched it and whether that needed elevation.

## 2. SmartScreen warning

The installer is not code-signed yet, so a warning is expected.

- [ ] Run the downloaded installer (from a browser download, so it has the "downloaded from the internet" mark). **Expect:** "Windows protected your PC".
- [ ] Choose **More info**. **Expect:** publisher "Unknown publisher" and a **Run anyway** button. Choose it. **Expect:** the installer starts normally.
- [ ] Record the exact wording you saw, for the release notes.

## 3. First launch

- [ ] Start Anehalo from the Start menu. **Expect:** a single window within a few seconds, with the onboarding welcome screen.
- [ ] **Expect:** the title bar shows the small red **note icon** (not the mascot), in light and dark themes. Toggle the theme with the title-bar switch to check both.
- [ ] **Expect:** the mascot appears on the onboarding screens and in **Settings → About Anehalo**.
- [ ] Minimize, maximize/restore, and close with the title-bar buttons. **Expect:** each works.

## 4. Onboarding with the default vault

- [ ] Click through onboarding, entering a first name and keeping the default notes location.
- [ ] **Expect:** the location step shows a final path ending in `Documents\Anehalo`.
- [ ] Finish. **Expect:** the home screen with a greeting and a welcome note; `Documents\Anehalo\Getting started\Welcome.md` exists.
- [ ] Create a note, type a few lines, wait two seconds. **Expect:** a matching `.md` file in the vault.

## 5. Custom vault

Do this in a second fresh user account, or after uninstalling and deleting the settings folder.

- [ ] Before launching, create a folder such as `C:\Users\<user>\Desktop\Big folder` and fill it with many unrelated files (for example copy a large folder with thousands of files into it).
- [ ] In onboarding, choose **Browse…** and select `Big folder`. **Expect:** the window stays responsive while you pick and afterwards (you can move it, hover buttons, and the progress dots animate); the final path shown is `…\Big folder\Anehalo`.
- [ ] Finish onboarding. **Expect:** the workspace opens within about two seconds and lists only the welcome note, none of the unrelated files.
- [ ] **Expect:** `Big folder\Anehalo` was created, and nothing else in `Big folder` changed.
- [ ] Open **Settings → Notes folder** and change to another location. **Expect:** the confirmation shows the final `…\Anehalo` path; after confirming, the notes from that folder load.
- [ ] Try the drive root (`C:\`) and `C:\Program Files`. **Expect:** a clear error each time and the picker still usable.

## 6. Hotkeys

Defaults: **Ctrl+Alt+N** (new quick note) and **Ctrl+Alt+A** (open/toggle Anehalo).

- [ ] Focus another app (for example Notepad) and press **Ctrl+Alt+N**. **Expect:** Anehalo comes to the front with a new, focused note.
- [ ] With Anehalo in the background, press **Ctrl+Alt+A**. **Expect:** Anehalo shows the same note you had open. Press it again while Anehalo is focused. **Expect:** it hides (tray on) or minimizes (tray off).
- [ ] Change one shortcut in **Settings → Shortcuts**, restart Anehalo, and test it. **Expect:** the new shortcut works and the old one does not.
- [ ] Try to set both shortcuts to the same keys. **Expect:** a clear error and the previous shortcuts still work.

## 7. Tray

- [ ] Turn on **Keep running in the tray**. Type in a note and close the window. **Expect:** the process stays in the tray and the text is saved on disk.
- [ ] Left-click the tray icon. **Expect:** the window comes back on the same note.
- [ ] Right-click the tray icon and try **Open Anehalo**, **New quick note**, **Settings**, and **Quit**. **Expect:** each does what it says; after **Quit**, no Anehalo process remains in Task Manager and the tray icon is gone.
- [ ] Turn the tray option off and close the window. **Expect:** the app exits.

## 8. Start with Windows

- [ ] Turn on **Start with Windows**. Sign out and back in. **Expect:** Anehalo starts in the tray without opening a window, and the hotkeys work.
- [ ] Turn it off, sign out and back in. **Expect:** no Anehalo process.

## 9. Single instance

- [ ] With Anehalo running, start it again from the Start menu, then from the desktop shortcut, then by double-clicking `%LOCALAPPDATA%\Anehalo\anehalo.exe`. **Expect:** still one process, one window, and one tray icon; the existing window comes to the front (also when it was minimized or hidden in the tray).

## 10. Command line: `--open` and `--new-note`

Run these from PowerShell. Replace the path if the install folder differs.

```powershell
& "$env:LOCALAPPDATA\Anehalo\anehalo.exe" --new-note
& "$env:LOCALAPPDATA\Anehalo\anehalo.exe" --open
& "$env:LOCALAPPDATA\Anehalo\anehalo.exe" --unknown
```

- [ ] With Anehalo **closed**, run `--new-note`. **Expect:** Anehalo starts and opens exactly one new, focused note.
- [ ] With Anehalo **running** (also try hidden in the tray and minimized), run `--new-note`. **Expect:** one new note in the existing window, no second process.
- [ ] Run `--open`. **Expect:** the existing window comes to the front with the same view, and no new note is created.
- [ ] Run `--unknown`. **Expect:** a clear message: "Unknown launch argument. Use --open or --new-note."

## 11. Uninstall

- [ ] Before uninstalling, note the files in the vault and the settings folder (or hash them with `Get-FileHash`).
- [ ] Quit Anehalo from the tray. Uninstall from **Settings → Apps → Installed apps** as the same standard user. **Expect:** no administrator prompt.
- [ ] If the uninstaller offers to delete app data, tick it. **Expect:** your notes and settings are still kept (the installer hook overrides it on purpose).
- [ ] **Expect:** the Start menu entry, desktop shortcut, and `%LOCALAPPDATA%\Anehalo` are gone.

## 12. Leftover files

After uninstalling, check what remains. Record each item as "kept (expected)" or "unexpected".

| Location                                                                    | Expected after uninstall                         | Found |
| --------------------------------------------------------------------------- | ------------------------------------------------ | ----- |
| `%LOCALAPPDATA%\Anehalo`                                                    | Removed                                          |       |
| `%USERPROFILE%\Documents\Anehalo` (or the custom vault)                     | Kept, files unchanged                            |       |
| `%APPDATA%\me.lakshitha.anehalo` (settings)                                 | Kept                                             |       |
| `%LOCALAPPDATA%\me.lakshitha.anehalo` (logs, WebView data)                  | Kept                                             |       |
| Start menu and desktop shortcuts                                            | Removed                                          |       |
| `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Anehalo` registry | Removed                                          |       |
| `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` value for Anehalo      | Removed; may remain if Start with Windows was on |       |
| Running `anehalo.exe` processes                                             | None                                             |       |

- [ ] Reinstall. **Expect:** Anehalo opens straight to the workspace with the same notes, settings, and theme (no onboarding).

## Sign-off

- [ ] Every box above is checked, or each unchecked one has a note explaining why.
- [ ] Any unexpected result has a GitHub issue linked here.

| Result | Notes / issue links |
| ------ | ------------------- |
|        |                     |
