import { useCallback, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, stat } from '@tauri-apps/plugin-fs';
import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { describeStorageError } from '@/features/storage/repository-result';
import { attachmentReference } from './attachment-paths';
import { imageExtensions, maximumImageBytes } from './image-validation';
import type { ImageInput } from './AttachmentRepository';

export function useImageAttachments(notePath: string) {
  const { createAttachmentRepository } = useAppServices();
  const vaultPath = useSettingsStore((state) => state.settings?.vaultPath ?? '');
  const repository = useMemo(
    () => createAttachmentRepository(vaultPath),
    [createAttachmentRepository, vaultPath],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const insertImage = useCallback(
    async (current: Editor, read: () => Promise<ImageInput>, position?: number) => {
      if (current.isDestroyed || !current.isEditable) return;
      const insertionPosition = position ?? current.state.selection.from;
      setPendingCount((count) => count + 1);
      setError(null);
      try {
        const result = await repository.importImage(await read());
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        if (current.isDestroyed) return;
        current
          .chain()
          .focus()
          .insertContentAt(Math.min(insertionPosition, current.state.doc.content.size), {
            type: 'image',
            attrs: {
              src: attachmentReference(notePath, result.value.vaultRelativePath),
              alt: result.value.alt,
            },
          })
          .run();
      } catch (caught) {
        setError(describeStorageError(caught, 'Could not add the image.').message);
      } finally {
        setPendingCount((count) => count - 1);
      }
    },
    [repository, notePath],
  );

  const insertFiles = useCallback(
    async (editor: Editor, files: readonly File[], position?: number) => {
      for (const file of files) {
        if (file.size > maximumImageBytes) {
          setError('This image is larger than 10 MB. Choose a smaller image.');
          continue;
        }
        await insertImage(
          editor,
          async () => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }),
          position,
        );
      }
    },
    [insertImage],
  );

  const chooseImage = useCallback(
    async (editor: Editor) => {
      if (!isTauri()) {
        fileInput.current?.click();
        return;
      }
      try {
        const path = await open({
          title: 'Insert an image',
          multiple: false,
          filters: [{ name: 'Images', extensions: imageExtensions }],
        });
        if (!path) return;
        if ((await stat(path)).size > maximumImageBytes) {
          setError('This image is larger than 10 MB. Choose a smaller image.');
          return;
        }
        await insertImage(editor, async () => ({
          name: path.split(/[\\/]/).at(-1) ?? 'Image',
          bytes: await readFile(path),
        }));
      } catch (caught) {
        setError(describeStorageError(caught, 'Could not open the image picker.').message);
      }
    },
    [insertImage],
  );

  return {
    repository,
    fileInput,
    error,
    clearError: () => setError(null),
    isAdding: pendingCount > 0,
    insertFiles,
    chooseImage,
  };
}
