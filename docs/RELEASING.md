# Releasing Anehalo

Pushing a tag such as `v0.1.0` makes GitHub Actions build the Windows installer and attach it to a **draft** GitHub Release. You test the draft, then publish it yourself. Nothing becomes public until you press Publish.

The workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml). Branch pushes and pull requests are checked separately by [`windows.yml`](../.github/workflows/windows.yml) (lint, typecheck, coverage, audits, Rust checks, native E2E, installer build).

## One-time setup

1. Open the repository on GitHub: **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, and save. The release workflow needs this to create the draft and upload files.
2. Make sure the repository is **public**. On a private repository, people cannot download from Releases.

## Release steps

Replace `0.1.1` with the new version. The default branch is `master`.

1. Bump the version everywhere it is stored:

   ```powershell
   npm run version:bump -- 0.1.1
   ```

   This updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package-lock.json` and `src-tauri/Cargo.lock`, and prints what changed. It refuses anything that is not a plain `x.y.z` version.

2. Add an entry to `CHANGELOG.md`.
3. Commit and push the default branch:

   ```powershell
   git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
   git commit -m "chore: release v0.1.1"
   git push origin master
   ```

4. Open the **Actions** tab and wait for the **Windows quality** run on that commit to go green. The release workflow only runs lint and unit tests, so this run is your full check (E2E, audits, Rust checks).
5. Create and push the tag:

   ```powershell
   git tag v0.1.1
   git push origin v0.1.1
   ```

6. Watch the **Release** run in the **Actions** tab. It stops with a clear error if the tag does not match the version in the files. When it finishes, the run summary shows the SHA-256 of `Anehalo-Setup.exe`.
7. Open **Releases** and find the draft. It holds two copies of the same installer: `Anehalo_0.1.1_x64-setup.exe` (built by Tauri) and `Anehalo-Setup.exe` (a fixed name for the landing page link).
8. Test the draft in **Windows Sandbox**: download `Anehalo-Setup.exe`, check that its hash matches the run summary (`Get-FileHash .\Anehalo-Setup.exe -Algorithm SHA256`), install it, and go through the [manual checklist](testing/manual-checklist.md). The installer is not code-signed, so choose **More info → Run anyway** on "Windows protected your PC".
9. When you are happy, edit the draft and press **Publish release**.

## Retry a failed release

Do this when the Release run failed, or when the draft is wrong and you need to rebuild it.

1. Delete the tag locally and on GitHub:

   ```powershell
   git tag -d v0.1.1
   git push origin --delete v0.1.1
   ```

2. On GitHub, open **Releases**, open the draft for that tag, and delete it. If the run failed before the build step (version check, lint or tests), there is no draft to delete.
3. Fix the problem if there is one: commit it, push `master`, and wait for **Windows quality** to go green.
4. Tag again and push the tag, as in step 5 above.

Delete the old draft before tagging again. Otherwise the new run reuses it and can leave old files in it.

Never delete the tag of a release you have already published. Ship a new version instead.

## Where the landing page link points

```
https://github.com/mrakiyaaa/anehalo/releases/latest/download/Anehalo-Setup.exe
```

GitHub redirects this link to `Anehalo-Setup.exe` in the newest release that is **published**. It does not work while the release is a draft, so a new version goes live for the landing page only when you press Publish. Before the first release is published, the link returns "Not Found".

## Notes

- Installers are **not code-signed**, and the workflow uses no secrets other than the automatic `GITHUB_TOKEN`. Windows SmartScreen will warn until signing is added.
- The tag must be `v` plus the version, for example `v0.1.1` for version `0.1.1`. Tags starting with `v` that do not match fail the version check.
