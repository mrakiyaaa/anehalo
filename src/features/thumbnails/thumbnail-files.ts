/** The cache folder's files, by name; outside the vault, so a vault never contains thumbnails. */
export interface ThumbnailFiles {
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
}

export class MemoryThumbnailFiles implements ThumbnailFiles {
  readonly files = new Map<string, Uint8Array>();
  failWrites = false;

  read(name: string) {
    return Promise.resolve(this.files.get(name) ?? null);
  }
  write(name: string, bytes: Uint8Array) {
    if (this.failWrites) return Promise.reject(new Error('Simulated cache write failure'));
    this.files.set(name, bytes);
    return Promise.resolve();
  }
  remove(name: string) {
    this.files.delete(name);
    return Promise.resolve();
  }
}
