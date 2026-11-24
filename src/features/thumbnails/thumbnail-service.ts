import { hasStartupMark, startupMarks } from '@/features/diagnostics/startup-marks';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import type { DiagramRepository, DiagramVersion } from '@/features/diagrams/DiagramRepository';
import { SerialTaskQueue } from '@/features/storage/autosave/SerialTaskQueue';
import type { Thumbnail, ThumbnailCache } from './thumbnail-cache';
import { renderThumbnail, type ThumbnailRenderer, type ThumbnailSize } from './thumbnail-renderer';

/** How long a diagram must stay unchanged after a save before its thumbnail is redrawn. */
export const THUMBNAIL_AFTER_SAVE_DELAY_MS = 2_000;

/**
 * Resolves once Home is usable and the browser is idle, so generating thumbnails (which loads
 * Excalidraw and draws on the main thread) never competes with startup or typing.
 */
export function afterStartupIdle(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === 'function')
        window.requestIdleCallback(() => resolve(), { timeout: 2_000 });
      else window.setTimeout(resolve, 0);
    };
    if (hasStartupMark(startupMarks.usable)) {
      whenIdle();
      return;
    }
    const observer = new PerformanceObserver((entries) => {
      if (entries.getEntriesByName(startupMarks.usable).length === 0) return;
      observer.disconnect();
      whenIdle();
    });
    observer.observe({ type: 'mark', buffered: true });
  });
}

interface ThumbnailServiceOptions {
  readonly cache: ThumbnailCache;
  readonly diagrams: DiagramRepository;
  readonly render?: ThumbnailRenderer;
  readonly waitForIdle?: () => Promise<void>;
  readonly afterSaveDelayMs?: number;
}

/**
 * Thumbnails for Home: served from the cache when the file is unchanged, otherwise drawn one at
 * a time in idle moments. A diagram that cannot be read gets an error placeholder, logged once
 * and not retried until the file changes.
 */
export class ThumbnailService {
  private readonly cache: ThumbnailCache;
  private readonly diagrams: DiagramRepository;
  private readonly render: ThumbnailRenderer;
  private readonly waitForIdle: () => Promise<void>;
  private readonly afterSaveDelayMs: number;
  private readonly generation = new SerialTaskQueue();
  private readonly listeners = new Set<(path: string) => void>();
  private readonly savedScenes = new Map<string, ReturnType<typeof setTimeout>>();

  constructor({
    cache,
    diagrams,
    render = renderThumbnail,
    waitForIdle = afterStartupIdle,
    afterSaveDelayMs = THUMBNAIL_AFTER_SAVE_DELAY_MS,
  }: ThumbnailServiceOptions) {
    this.cache = cache;
    this.diagrams = diagrams;
    this.render = render;
    this.waitForIdle = waitForIdle;
    this.afterSaveDelayMs = afterSaveDelayMs;
  }

  /** Called with a diagram's path whenever its thumbnail was redrawn. */
  subscribe(listener: (path: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async version(path: string): Promise<DiagramVersion | null> {
    const version = await this.diagrams.diagramVersion(path);
    return version.ok ? version.value : null;
  }

  /**
   * The current thumbnail at a size (Home cards, or previews embedded in notes), generating it if
   * needed; null when the file no longer exists. A cached one is read without loading Excalidraw.
   */
  async thumbnail(path: string, size: ThumbnailSize = 'card'): Promise<Thumbnail | null> {
    const version = await this.version(path);
    if (!version) return null;
    const cached = await this.cache.lookup(path, version, size);
    if (cached) return cached;
    return this.generation.run(async () => {
      await this.waitForIdle();
      const current = await this.version(path);
      if (!current) return null;
      // Another request may have drawn it while this one waited.
      return (await this.cache.lookup(path, current, size)) ?? this.generate(path, current, size);
    });
  }

  private async generate(
    path: string,
    version: DiagramVersion,
    size: ThumbnailSize,
  ): Promise<Thumbnail> {
    const loaded = await this.diagrams.readDiagram(path);
    if (!loaded.ok) {
      // Only a corrupt file is remembered; a read that failed may work next time.
      if (loaded.error.code !== 'invalid-diagram') return { state: 'error' };
      logFailure('thumbnail-failed', loaded.error.code);
      return this.keep(path, version, { state: 'corrupt' }, size);
    }
    return this.keep(path, version, await this.draw(loaded.value.scene, size), size);
  }

  private async draw(scene: DiagramScene, size: ThumbnailSize): Promise<Thumbnail> {
    try {
      return await this.render(scene, size);
    } catch (error) {
      logFailure('thumbnail-failed');
      console.warn('A diagram thumbnail could not be drawn.', error);
      return { state: 'error' };
    }
  }

  private async keep(
    path: string,
    version: DiagramVersion,
    thumbnail: Thumbnail,
    size: ThumbnailSize,
  ) {
    try {
      await this.cache.store(path, version, thumbnail, size);
    } catch (error) {
      // Without the cache the thumbnail still shows now; it is drawn again next time.
      logFailure('thumbnail-cache-failed');
      console.warn('A diagram thumbnail could not be cached.', error);
    }
    return thumbnail;
  }

  /**
   * Redraws the open diagram's card from its in-memory scene once editing pauses, so the drawing
   * that is already loaded is used and a save never waits for a thumbnail. Listeners (Home cards,
   * embedded previews) are told, and previews redraw on their next request.
   */
  sceneSaved(path: string, scene: DiagramScene) {
    const pending = this.savedScenes.get(path);
    if (pending !== undefined) clearTimeout(pending);
    this.savedScenes.set(
      path,
      setTimeout(() => {
        this.savedScenes.delete(path);
        void this.generation.run(async () => {
          await this.waitForIdle();
          const version = await this.version(path);
          if (!version) return;
          await this.keep(path, version, await this.draw(scene, 'card'), 'card');
          for (const listener of this.listeners) listener(path);
        });
      }, this.afterSaveDelayMs),
    );
  }

  /** Follows a rename or move of a diagram or folder; never fails the change itself. */
  async moved(previousPath: string, nextPath: string): Promise<void> {
    await this.cacheChange(() => this.cache.move(previousPath, nextPath));
  }

  /** Forgets a diagram or folder moved to trash; never fails the change itself. */
  async removed(path: string): Promise<void> {
    const pending = this.savedScenes.get(path);
    if (pending !== undefined) clearTimeout(pending);
    this.savedScenes.delete(path);
    await this.cacheChange(() => this.cache.remove(path));
  }

  private async cacheChange(change: () => Promise<void>) {
    try {
      await change();
    } catch (error) {
      // A stale entry is harmless: lookups check the file's version before using it.
      logFailure('thumbnail-cache-failed');
      console.warn('The thumbnail cache could not follow a file change.', error);
    }
  }

  /** Drops redraws still waiting for editing to pause; used when saving is paused. */
  cancelPending() {
    for (const timer of this.savedScenes.values()) clearTimeout(timer);
    this.savedScenes.clear();
  }
}
