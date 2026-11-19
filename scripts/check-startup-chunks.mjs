import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Excalidraw is several megabytes. It must load only when a diagram opens, never at startup,
// and its fonts must ship with the app because Anehalo makes no network requests.
const distribution = 'dist';
const html = await readFile(join(distribution, 'index.html'), 'utf8');
const startupFiles = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  ([, path]) => path,
);
if (startupFiles.length === 0) throw new Error('dist/index.html lists no startup scripts.');

const excalidrawMarkers = ['EXCALIDRAW_ASSET_PATH', '.excalidraw-container', 'excalidraw-modal'];
const failures = [];
for (const file of startupFiles) {
  const content = await readFile(join(distribution, file), 'utf8');
  const marker = excalidrawMarkers.find((candidate) => content.includes(candidate));
  if (marker) failures.push(`${file} contains Excalidraw code ("${marker}").`);
}

const fontFolder = join(distribution, 'excalidraw', 'fonts', 'Excalifont');
try {
  if (!(await stat(fontFolder)).isDirectory()) failures.push(`${fontFolder} is not a folder.`);
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
    failures.push(`${fontFolder} is missing; run scripts/copy-excalidraw-assets.mjs.`);
  else throw error;
}

for (const failure of failures) console.error(failure);
if (failures.length > 0) process.exitCode = 1;
else
  console.log(`Startup loads ${startupFiles.length} files, none from Excalidraw; fonts bundled.`);
