import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Excalidraw loads its fonts from a CDN unless window.EXCALIDRAW_ASSET_PATH points at a local
// copy. Anehalo makes no network requests, so the fonts are copied from the installed package
// into public/, which Vite serves in development and copies into every build.
const packageDirectory = resolve('node_modules', '@excalidraw', 'excalidraw');
const { version } = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
const sourceFonts = join(packageDirectory, 'dist', 'prod', 'fonts');
const destination = resolve('public', 'excalidraw');
const destinationFonts = join(destination, 'fonts');
const versionMarker = join(destination, '.version');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

if (!(await exists(sourceFonts)))
  throw new Error(`Excalidraw ${version} has no fonts at ${sourceFonts}. Check its release notes.`);

const copiedVersion = (await exists(versionMarker))
  ? (await readFile(versionMarker, 'utf8')).trim()
  : null;
if (copiedVersion === version && (await exists(destinationFonts))) {
  console.log(`Excalidraw ${version} fonts are already in public/excalidraw.`);
} else {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(sourceFonts, destinationFonts, { recursive: true });
  await writeFile(versionMarker, `${version}\n`);
  console.log(`Copied Excalidraw ${version} fonts to public/excalidraw/fonts.`);
}
