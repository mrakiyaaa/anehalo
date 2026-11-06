import type { NoteRepository } from '@/features/storage/NoteRepository';
import { decodeNotePath } from './note-link-paths';
import { parentPath, pathName } from '@/features/storage/storage-paths';
import { failure } from '@/features/storage/repository-result';

export async function restoreLinkedNote(repository: NoteRepository, path: string) {
  const validated = decodeNotePath(encodeURIComponent(path).replaceAll('%2F', '/'));
  if (!validated.ok) return validated;
  const existing = await repository.readNote(path);
  if (existing.ok || existing.error.code !== 'not-found') return existing;
  const tree = await repository.listTree();
  if (!tree.ok) return tree;
  const folders = new Set(tree.value.folders.map((folder) => folder.relativePath));
  const parent = parentPath(path);
  let prefix = '';
  for (const name of parent ? parent.split('/') : []) {
    const next = prefix ? `${prefix}/${name}` : name;
    if (!folders.has(next)) {
      const created = await repository.createFolder(name, prefix || null);
      if (!created.ok) return created;
      if (created.value.relativePath !== next)
        return failure({
          code: 'conflict',
          message: 'The folder changed while restoring this note. Please try again.',
        });
    }
    prefix = next;
  }
  return repository.createNote({
    title: pathName(path).replace(/\.md$/i, ''),
    folder: parent || null,
  });
}
