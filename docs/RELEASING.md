# Releasing Anehalo

Pushing a tag such as `v0.1.1` makes GitHub Actions build the Windows installer, sign it for the updater, and attach everything to a **draft** GitHub Release. You test the draft, then publish it yourself. Nothing becomes public, and no installed copy hears about it, until you press Publish.

The workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml). Branch pushes and pull requests are checked separately by [`windows.yml`](../.github/workflows/windows.yml) (lint, typecheck, coverage, audits, Rust checks, native E2E, installer build).

> **⚠️ Never lose the updater private key.**
> Every installed copy of Anehalo trusts exactly one updater public key, the one inside `src-tauri/tauri.conf.json` when that copy was built. It accepts an update only if it is signed with the matching **private key**.
>
> If the private key or its password is lost, or the key is ever replaced, **every installed copy rejects every future update, permanently.** There is no way to fix this remotely: each person would have to download and reinstall Anehalo by hand. Changing `pubkey` in `tauri.conf.json` does not help copies that are already installed.
>
> - Keep a backup of `%USERPROFILE%\.tauri\anehalo.key` **and** its password in a password manager, plus one offline copy.
> - Never commit it, paste it into a chat or issue, or print it in a log. The repository holds it only as the GitHub secret `TAURI_SIGNING_PRIVATE_KEY`.
> - Do not generate a new key unless you accept that nobody can update from an older version.

## One-time setup

1. Open the repository on GitHub: **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, and save. The release workflow needs this to create the draft and upload files.
2. Make sure the repository is **public**. On a private repository, people cannot download from Releases, and installed copies cannot read `latest.json`.
3. Under **Settings → Secrets and variables → Actions**, create two repository secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: the full contents of the private key file.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: its password.

   The matching public key is already in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). It is meant to be public.

## Release steps

Replace `0.1.2` with the new version. The default branch is `master`.

1. Bump the version everywhere it is stored:

   ```powershell
   npm run version:bump -- 0.1.2
   ```

   This updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package-lock.json` and `src-tauri/Cargo.lock`, and prints what changed. It refuses anything that is not a plain `x.y.z` version. The new version must be **higher** than the one people have installed, or the updater will not offer it.

2. Add an entry to `CHANGELOG.md`.
3. Commit and push the default branch:

   ```powershell
   git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
   git commit -m "chore: release v0.1.2"
   git push origin master
   ```

4. Open the **Actions** tab and wait for the **Windows quality** run on that commit to go green. The release workflow only runs lint and unit tests, so this run is your full check (E2E, audits, Rust checks).
5. Create and push the tag:

   ```powershell
   git tag v0.1.2
   git push origin v0.1.2
   ```

6. Watch the **Release** run in the **Actions** tab. It stops with a clear error if the tag does not match the version in the files, or if the signing secret is missing. When it finishes, the run summary shows the SHA-256 of `Anehalo-Setup.exe`.
7. Open **Releases** and find the draft. It should hold four files:
   - `Anehalo_0.1.2_x64-setup.exe`: the installer, built by Tauri.
   - `Anehalo_0.1.2_x64-setup.exe.sig`: its updater signature.
   - `latest.json`: what installed copies read to learn that a new version exists.
   - `Anehalo-Setup.exe`: a copy of the installer under a fixed name for the landing page link.

   The workflow fails if `latest.json` or the `.sig` is missing.

8. Test the draft in **Windows Sandbox**: download `Anehalo-Setup.exe`, check that its hash matches the run summary (`Get-FileHash .\Anehalo-Setup.exe -Algorithm SHA256`), install it, and go through the [manual checklist](testing/manual-checklist.md). The installer is not code-signed with a Windows certificate, so choose **More info → Run anyway** on "Windows protected your PC".
9. When you are happy, edit the draft and press **Publish release**. **This is the moment installed copies can see the update.**

## How updates reach people

1. Ten seconds after Anehalo starts, and every six hours while it keeps running, an installed copy downloads
   `https://github.com/mrakiyaaa/anehalo/releases/latest/download/latest.json`.
   This can be turned off in **Settings → Updates → Automatically check for updates**. Failures such as being offline are logged quietly and never shown.
2. GitHub sends `releases/latest/…` to the newest release that is **published and not a pre-release**. If `latest.json` names a higher version, a small banner appears: "Anehalo 0.1.2 is available", with **Update now** and **Later**. **Later** hides it until the next start. If the window is hidden in the tray, the banner waits there until the window is next shown; Anehalo never pops itself up.
3. **Update now** saves every open note and setting, downloads the installer, checks its signature against the public key built into the app, saves once more, and runs the installer in passive mode (a small progress window, no questions, no administrator prompt). The installer closes Anehalo, installs for the current user, and starts it again. Notes and settings are kept, because the uninstaller never deletes them.
4. **Settings → Updates → Check for updates** does the same check on demand and says "You're up to date (0.1.2)" or shows the update.

Updates are never checked or installed in development builds (`npm run tauri dev`) or in the isolated E2E builds.

> **A draft release is invisible to the updater.** `latest.json` is only reachable once the release is published, so a draft can never reach anyone by accident. The flip side: you cannot test updating from a draft. You have to publish (see below). A release marked **pre-release** is also skipped by `releases/latest`.

### The first updater release

`v0.1.0` was published before updating existed, so it contains no updater. Copies installed from it cannot update themselves. Whoever has v0.1.0 must download and run the installer from the first release that includes the updater (`v0.1.1` or later) **once**. From then on, updates arrive by themselves.

## Testing an update end to end

You need two published releases that both include the updater, for example `v0.1.1` and `v0.1.2`.

1. Release `0.1.1` with the steps above and publish it. Install it from `Anehalo-Setup.exe` on a test machine or in Windows Sandbox. Open Settings and confirm it says **Version 0.1.1**.
2. On your development machine, release `0.1.2` with the steps above. **Do not publish yet.** Confirm the draft holds all four files, and that the installed 0.1.1 shows nothing new (drafts are invisible).
3. Publish `v0.1.2`.
4. In 0.1.1, open **Settings → Updates → Check for updates**, or wait for the 10-second startup check or the 6-hour timer. The banner says "Anehalo 0.1.2 is available".
5. Open a note and type a sentence, then press **Update now** straight away, so the text is still being saved when you do. Watch the progress, then the installer's progress window. Anehalo restarts.
6. Check: Settings says **Version 0.1.2**, the sentence you typed is in the note, and your other notes and settings are unchanged.
7. Also try **Later** (banner hides, stays hidden until the next start), turning off **Automatically check for updates**, and pressing **Check for updates** while offline (it says it could not check; nothing else).

If an update does not appear, check in this order:

- Is the release published, not a draft or pre-release? Open the `latest.json` URL above in a browser; it must show the new version.
- Is the version in `latest.json` higher than the installed one?
- Does the signature match? A `.sig` made with a different key makes the installed copy reject the update and log `update-install-failed`. See `%LOCALAPPDATA%\me.lakshitha.anehalo\logs`.

## Building locally with updater artifacts

`npm run tauri build` produces the installer and its `.sig`, so it needs the private key. `TAURI_SIGNING_PRIVATE_KEY` accepts either the key's contents or the **path** to the key file. Use the path, so the key itself is never copied into a terminal or log:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\anehalo.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<the key's password>"   # type it here, never commit it
npm run tauri build
```

(`TAURI_SIGNING_PRIVATE_KEY_PATH` is only read by the separate `tauri signer sign` command, not by `tauri build`.) The variables last only for that terminal window.

The installer and `.sig` are written to `src-tauri/target/release/bundle/nsis/`. Quality-assurance builds (`npm run build:installer`, used by `windows.yml`) need no key: they skip the updater artifacts when no key is set.

## Retry a failed release

Do this when the Release run failed, or when the draft is wrong and you need to rebuild it.

1. Delete the tag locally and on GitHub:

   ```powershell
   git tag -d v0.1.2
   git push origin --delete v0.1.2
   ```

2. On GitHub, open **Releases**, open the draft for that tag, and delete it. This also removes its `latest.json` and `.sig`. If the run failed before the build step (version check, lint, tests or the signing secret check), there is no draft to delete.
3. Fix the problem if there is one: commit it, push `master`, and wait for **Windows quality** to go green.
4. Tag again and push the tag, as in step 5 above.

Delete the old draft before tagging again. Otherwise the new run reuses it and can leave old files in it.

Never delete the tag of a release you have already published. Installed copies may already have downloaded its `latest.json`. Ship a new, higher version instead.

## Where the landing page link points

```
https://github.com/mrakiyaaa/anehalo/releases/latest/download/Anehalo-Setup.exe
```

GitHub redirects this link to `Anehalo-Setup.exe` in the newest release that is **published**. It does not work while the release is a draft, so a new version goes live for the landing page only when you press Publish.

## Notes

- The installer is **not code-signed with a Windows certificate**, so Windows SmartScreen will warn on a first manual install until one is added. The updater signature is a separate thing: it proves an update came from you, and it works without a Windows certificate.
- The release workflow uses three secrets: the automatic `GITHUB_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- `plugins.updater.requireSignedVersion` is on. An update is rejected unless the version written inside its signature matches the version in `latest.json`. This stops anyone from pairing a higher version number with an older signed installer to force a downgrade.
- The tag must be `v` plus the version, for example `v0.1.2` for version `0.1.2`. Tags starting with `v` that do not match fail the version check.
