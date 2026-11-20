import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Excalidraw is several megabytes. It must load only when a diagram opens, never at startup,
// and its fonts must ship with the app because Anehalo makes no network requests.
const distribution = 'dist';
const html = await readFile(join(distribution, 'index.html'), 'utf8');
const startupFiles = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  ([, path]) => path,
);
if (startupFiles.length === 0) throw new Error('dist/index.html lists no startup scripts.');

// Class names from Excalidraw's own code. (Its globals are set at startup on purpose, so their
// names are not markers.)
const excalidrawMarkers = ['.excalidraw-container', 'excalidraw-modal', 'excalidraw__canvas'];
const failures = [];
for (const file of startupFiles) {
  const content = await readFile(join(distribution, file), 'utf8');
  const marker = excalidrawMarkers.find((candidate) => content.includes(candidate));
  if (marker) failures.push(`${file} contains Excalidraw code ("${marker}").`);
}

// Mermaid (Excalidraw's text-to-diagram) is replaced by a stub; none of its code may ship.
const textToDiagramCode = /mermaid|katex|cytoscape/i;
for (const file of await readdir(join(distribution, 'assets')))
  if (textToDiagramCode.test(file))
    failures.push(`assets/${file} is Mermaid code, which must not ship.`);

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
