import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const configuration = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
if (configuration.bundle.windows.nsis.installMode !== 'currentUser')
  throw new Error('Anehalo must install per user.');
const template = await readFile('src-tauri/target/qa/release/nsis/x64/installer.nsi', 'utf8');
const hook = await readFile('src-tauri/installer/hooks.nsh', 'utf8');
if (
  !template.includes('Call CreateOrUpdateStartMenuShortcut') ||
  !template.includes('!insertmacro NSIS_HOOK_POSTINSTALL') ||
  !hook.includes('Call CreateOrUpdateDesktopShortcut')
)
  throw new Error('The installer must create Start menu and desktop shortcuts.');
const hookPosition = template.indexOf('!insertmacro NSIS_HOOK_PREUNINSTALL');
const removalPosition = template.lastIndexOf('${If} $DeleteAppDataCheckboxState = 1');
if (
  hookPosition < 0 ||
  removalPosition <= hookPosition ||
  !hook.includes('StrCpy $DeleteAppDataCheckboxState 0')
)
  throw new Error('The generated uninstaller does not protect app data.');
if (
  /StrCpy \$DeleteAppDataCheckboxState|Pop \$DeleteAppDataCheckboxState/.test(
    template.slice(hookPosition, removalPosition),
  )
)
  throw new Error('The uninstaller changes the preservation flag after the safety hook.');
const installer = `src-tauri/target/qa/release/bundle/nsis/Anehalo_${configuration.version}_x64-setup.exe`;
const checksum = createHash('sha256')
  .update(await readFile(installer))
  .digest('hex');
await writeFile(`${installer}.sha256`, `${checksum}  ${basename(installer)}\n`);
console.log(`Per-user NSIS and uninstall preservation verified. SHA-256: ${checksum}`);
