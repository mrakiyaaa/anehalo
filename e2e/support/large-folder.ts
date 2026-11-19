import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface LargeFolderShape {
  folders: number;
  subfoldersPerFolder: number;
  filesPerSubfolder: number;
}

export const fiveThousandFiles: LargeFolderShape = {
  folders: 50,
  subfoldersPerFolder: 10,
  filesPerSubfolder: 10,
};

export async function createLargeFolder(root: string, shape: LargeFolderShape): Promise<number> {
  let fileCount = 0;
  for (let folder = 0; folder < shape.folders; folder += 1) {
    for (let subfolder = 0; subfolder < shape.subfoldersPerFolder; subfolder += 1) {
      const directory = join(root, `Folder ${folder}`, `Nested ${subfolder}`);
      await mkdir(directory, { recursive: true });
      const files = Array.from({ length: shape.filesPerSubfolder }, (_, file) =>
        writeFile(join(directory, `File ${file}.md`), 'An unrelated file outside the vault.'),
      );
      await Promise.all(files);
      fileCount += files.length;
    }
  }
  return fileCount;
}
