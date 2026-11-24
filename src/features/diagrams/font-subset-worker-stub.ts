/**
 * Replaces Excalidraw's font subsetting worker (see font-subset-shared-stub.ts). Fonts pass
 * through unchanged, so the worker is turned off in vite.config.ts and this module only has to
 * exist; without a URL, Excalidraw would never be able to start one.
 */
export const WorkerUrl = undefined;
