# Windows release checklist

Run on a clean Windows 10/11 VM with a standard, non-administrator account. Record Windows/WebView2 versions, installer SHA-256, tester, date, and pass/fail evidence. Use a disposable vault with known Markdown and image files. Do not use personal notes. Unchecked items are **unverified**, not passed by the automated suite.

- [ ] **Install:** Run `Anehalo_0.1.0_x64-setup.exe` without elevation. Expect a per-user installation, the Anehalo icon and correct version/publisher in Installed Apps, and a working Start-menu shortcut. WebView2 may need installation if absent. Document any prerequisite elevation separately.
- [ ] **First run:** Launch from Start, finish onboarding with a name and custom notes directory. Expect the home screen, a welcome note for an empty vault, and settings under `%APPDATA%\me.lakshitha.anehalo`. Repeat in another Windows user with Skip setup; expect Documents\Anehalo.
- [ ] **Global shortcut:** With another application focused, press `Ctrl+Alt+N`. Expect Anehalo to show and a new focused note. Change the shortcut in Settings and repeat. Assign one already used by another app; expect a clear error and the previous shortcut to continue working. Test while a note has unsaved text.
- [ ] **Tray:** Enable Keep running in the tray. Type, close the window, and inspect the Markdown on disk. Expect the latest text saved and the process to remain in the tray. Left-click its icon to restore. Right-click and try Open, New quick note, Settings, and Quit. Quit must save notes/settings and remove the tray icon. Repeat with Keep running disabled; closing must exit.
- [ ] **Autostart:** Enable Start with Windows. Sign out and back in. Expect Anehalo in the tray with no initial window; shortcut and tray restore should work. Disable it, sign out/in again, and expect no Anehalo process. Test with an ordinary user account.
- [ ] **Single instance:** Launch Anehalo twice from Start and then run the executable from Explorer. Expect one process/window and restoration of an existing minimized/hidden window, with no extra tray icons or loss of text.
- [ ] **Keyboard and screen reader:** Tab through home, editor, search, menus, onboarding, and Settings in both themes. Expect visible focus, meaningful labels, Escape to close dialogs, restored focus, and no keyboard trap. Check Narrator, 125%/150% display scaling, and high contrast.
- [ ] **Native dialogs:** Export Markdown with images and PDF to a new folder. Cancel each dialog once. Expect no partial output on cancellation and correct image references/assets after success. Open the PDF and check Sinhala/Tamil glyphs, page breaks, and tables.
- [ ] **Read-only vault:** Revoke the test account's write access to its disposable vault while the app is running. Edit a note and close. Expect a visible save error, the window to stay open, and the original file intact. Restore access, Retry, then close and verify the latest text. Repeat during onboarding; it must reject the folder.
- [ ] **Deleted vault:** While editing, rename the disposable vault in Explorer. Edit/close. Expect a recoverable missing-file error, retained editor text, and no silent replacement of the vault. Restore its original path and use the recovery action; verify text on disk.
- [ ] **Disk full:** Place a disposable vault on a small test VHD, fill that VHD, edit a note, and close. Expect a failed-save notice, retained text, and the original Markdown intact. Free space and retry. Never fill the system drive. Unit tests cover injected disk-full failures; this checks the operating system behavior.
- [ ] **Long/unusual names and large notes:** Create a title of 1,000 characters, names containing Sinhala, emoji, quotes, `?`, `:`, and Windows reserved names (`CON`, `NUL`). Expect safe bounded filenames, preserved Unicode, reserved-name errors, and no traversal. Open/edit/save/restart a 1 MB note; expect exact saved content and a responsive app.
- [ ] **Logging:** Trigger a failed save and inspect `%LOCALAPPDATA%\me.lakshitha.anehalo\logs`. Expect an event and error code, no title, path, note body, stack, or raw error message. Logs rotate at 1 MB and retain three archives. Debug isolated runs use their temporary runtime folder.
- [ ] **Uninstall preservation:** Before uninstall, hash notes, images, `.trash`, and settings. Quit Anehalo, uninstall via Installed Apps as the same non-admin user, and verify hashes and paths remain. Test both silent uninstall and interactive uninstall with any “delete app data” box selected: the hook must override deletion. Repeat with a custom vault. Expect binaries/shortcuts removed and user data retained. Reinstall and expect the same settings and notes.
- [ ] **Clean restart:** Restart Windows and reopen after installation/reinstallation. Expect no console errors and working shortcuts, tray, export, image loading, and remembered theme/vault.

## Sign-off

| Item                              | Evidence |
| --------------------------------- | -------- |
| Windows / WebView2                | Pending  |
| Installer SHA-256                 | Pending  |
| Standard-user install / uninstall | Pending  |
| Native features                   | Pending  |
| Tester / date                     | Pending  |

Release approval requires all checks above to pass. Automated success does not constitute clean-machine or native-feature sign-off.
