import { readFile } from 'node:fs/promises';

const binary = await readFile('src-tauri/target/qa/release/anehalo.exe');
if (binary.includes(Buffer.from('ANEHALO_TEST_ROOT')))
  throw new Error('The release executable contains the debug isolation override.');
console.log('The release executable contains no debug test-root override.');
