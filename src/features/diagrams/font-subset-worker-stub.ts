import { Commands } from './font-subset-shared-stub';

/**
 * Replaces Excalidraw's font subsetting worker (see font-subset-shared-stub.ts). Excalidraw
 * loads this chunk as a worker and posts it fonts; it answers with each font unchanged.
 */
export const WorkerUrl = import.meta.url ? new URL(import.meta.url) : undefined;

interface SubsetRequest {
  readonly command: string;
  readonly arrayBuffer: ArrayBuffer;
}

if (typeof window === 'undefined' && typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<SubsetRequest>) => {
    if (event.data.command === Commands.Subset)
      self.postMessage(event.data.arrayBuffer, { transfer: [event.data.arrayBuffer] });
  };
}
