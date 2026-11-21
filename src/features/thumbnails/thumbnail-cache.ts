import { SerialTaskQueue } from '@/features/storage/autosave/SerialTaskQueue';
import { isInsideFolder } from '@/features/storage/storage-paths';
import type { DiagramVersion } from '@/features/diagrams/DiagramRepository';
import type { ThumbnailFiles } from './thumbnail-files';
import type { ThumbnailSize } from './thumbnail-renderer';

/** What a diagram's thumbnail is: an image, or a placeholder that needs no image. */
export type Thumbnail =
  | { readonly state: 'image'; readonly bytes: Uint8Array; readonly mimeType: string }
  | { readonly state: 'empty' }
  | { readonly state: 'error' };

interface IndexEntry {
  readonly vault: string;
  readonly path: string;
  /** Missing in entries written before previews existed, which are all cards. */
  readonly size?: ThumbnailSize;
  readonly version: DiagramVersion;
  readonly state: Thumbnail['state'];
  readonly mimeType: string | null;
  readonly bytes: number;
  lastUsed: number;
}

interface CacheIndex {
  readonly format: 1;
  readonly entries: Record<string, IndexEntry>;
}

export const THUMBNAIL_CACHE_LIMIT_BYTES = 200 * 1024 * 1024;
const indexFile = 'index.json';

/** A file name for one diagram of one vault; the vault path is normalised as Windows treats it. */
export async function thumbnailKey(
  vault: string,
  relativePath: string,
  size: ThumbnailSize = 'card',
): Promise<string> {
  const normalizedVault = vault.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  // Cards keep the key they had before previews existed, so existing caches stay valid.
  const variant = size === 'card' ? '' : `\n${size}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${normalizedVault}\n${relativePath.toLowerCase()}${variant}`),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function sameVersion(first: DiagramVersion, second: DiagramVersion) {
  return first.modifiedAt === second.modifiedAt && first.size === second.size;
}

function parseIndex(text: string | null): CacheIndex {
  if (!text) return { format: 1, entries: {} };
  try {
    const parsed = JSON.parse(text) as Partial<CacheIndex>;
    if (parsed.format === 1 && parsed.entries && typeof parsed.entries === 'object')
      return { format: 1, entries: parsed.entries };
  } catch (error) {
    // A torn index only costs regenerating thumbnails; the images are rebuilt on demand.
    console.warn('The thumbnail index was unreadable and has been reset.', error);
  }
  return { format: 1, entries: {} };
}

/**
 * Thumbnails of one vault's diagrams, kept outside the vault. An entry is valid only for the
 * file version (mtime and size) it was made from; hashing contents would mean reading every
 * diagram, up to 15 MB each, just to show Home.
 */
export class ThumbnailCache {
  private index: CacheIndex | null = null;
  private readonly tasks = new SerialTaskQueue();

  constructor(
    private readonly files: ThumbnailFiles,
    private readonly vault: string,
    private readonly limitBytes = THUMBNAIL_CACHE_LIMIT_BYTES,
    private readonly now: () => number = Date.now,
  ) {}

  private async loadIndex(): Promise<CacheIndex> {
    if (this.index) return this.index;
    const bytes = await this.files.read(indexFile);
    this.index = parseIndex(bytes ? new TextDecoder().decode(bytes) : null);
    return this.index;
  }

  private async saveIndex(index: CacheIndex) {
    await this.files.write(indexFile, new TextEncoder().encode(JSON.stringify(index)));
  }

  private imageName(key: string) {
    return `${key}.img`;
  }

  /** The thumbnail made from exactly this version, or null when there is none or it is stale. */
  lookup(
    path: string,
    version: DiagramVersion,
    size: ThumbnailSize = 'card',
  ): Promise<Thumbnail | null> {
    return this.tasks.run(async () => {
      const index = await this.loadIndex();
      const key = await thumbnailKey(this.vault, path, size);
      const entry = index.entries[key];
      if (!entry || !sameVersion(entry.version, version)) return null;
      entry.lastUsed = this.now();
      if (entry.state !== 'image') return { state: entry.state };
      const bytes = await this.files.read(this.imageName(key));
      if (!bytes || !entry.mimeType) return null;
      return { state: 'image', bytes, mimeType: entry.mimeType };
    });
  }

  store(
    path: string,
    version: DiagramVersion,
    thumbnail: Thumbnail,
    size: ThumbnailSize = 'card',
  ): Promise<void> {
    return this.tasks.run(async () => {
      const index = await this.loadIndex();
      const key = await thumbnailKey(this.vault, path, size);
      if (thumbnail.state === 'image') await this.files.write(this.imageName(key), thumbnail.bytes);
      else await this.files.remove(this.imageName(key));
      index.entries[key] = {
        vault: this.vault,
        path,
        size,
        version,
        state: thumbnail.state,
        mimeType: thumbnail.state === 'image' ? thumbnail.mimeType : null,
        bytes: thumbnail.state === 'image' ? thumbnail.bytes.byteLength : 0,
        lastUsed: this.now(),
      };
      await this.evict(index, key);
      await this.saveIndex(index);
    });
  }

  /** Least recently used images go first; the one just stored always stays. */
  private async evict(index: CacheIndex, keep: string) {
    let total = Object.values(index.entries).reduce((sum, entry) => sum + entry.bytes, 0);
    const candidates = Object.entries(index.entries)
      .filter(([key]) => key !== keep)
      .sort(([, first], [, second]) => first.lastUsed - second.lastUsed);
    for (const [key, entry] of candidates) {
      if (total <= this.limitBytes) break;
      await this.files.remove(this.imageName(key));
      Reflect.deleteProperty(index.entries, key);
      total -= entry.bytes;
    }
  }

  private entriesInside(index: CacheIndex, path: string) {
    return Object.entries(index.entries).filter(
      ([, entry]) => entry.vault === this.vault && isInsideFolder(entry.path, path),
    );
  }

  /** Follows a rename or move made in Anehalo: a diagram, or every diagram in a folder. */
  move(previousPath: string, nextPath: string): Promise<void> {
    return this.tasks.run(async () => {
      const index = await this.loadIndex();
      for (const [key, entry] of this.entriesInside(index, previousPath)) {
        const path = `${nextPath}${entry.path.slice(previousPath.length)}`;
        const nextKey = await thumbnailKey(this.vault, path, entry.size);
        if (entry.state === 'image') {
          const bytes = await this.files.read(this.imageName(key));
          if (bytes) await this.files.write(this.imageName(nextKey), bytes);
          await this.files.remove(this.imageName(key));
        }
        Reflect.deleteProperty(index.entries, key);
        index.entries[nextKey] = { ...entry, path };
      }
      await this.saveIndex(index);
    });
  }

  /** Forgets a diagram, or every diagram in a folder, moved to trash. */
  remove(path: string): Promise<void> {
    return this.tasks.run(async () => {
      const index = await this.loadIndex();
      for (const [key] of this.entriesInside(index, path)) {
        await this.files.remove(this.imageName(key));
        Reflect.deleteProperty(index.entries, key);
      }
      await this.saveIndex(index);
    });
  }
}
