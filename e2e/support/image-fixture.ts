import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeImageFixture(directory: string) {
  const path = join(directory, 'flower.png');
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  await writeFile(path, bytes);
  return { path, bytes };
}
