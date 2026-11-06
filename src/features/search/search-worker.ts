import {
  processSearchText,
  type SearchProcessingRequest,
  type SearchProcessingResponse,
} from './search-processing';

const worker = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SearchProcessingRequest>) => void) | null;
  postMessage: (response: SearchProcessingResponse) => void;
};
worker.onmessage = (event) => worker.postMessage(processSearchText(event.data));
