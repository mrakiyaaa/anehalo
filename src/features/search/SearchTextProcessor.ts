import { failure, type RepositoryError } from '@/features/storage/repository-result';
import {
  processSearchText,
  type SearchProcessingRequest,
  type SearchProcessingResponse,
} from './search-processing';

export class SearchTextProcessor {
  private worker: Worker | null = null;
  private identifier = 0;
  private pending = new Map<
    number,
    { request: SearchProcessingRequest; resolve: (response: SearchProcessingResponse) => void }
  >();

  analyze(title: string, markdown: string) {
    return this.run({ identifier: ++this.identifier, kind: 'analyze', title, markdown });
  }
  snippet(text: string, query: string) {
    return this.run({ identifier: ++this.identifier, kind: 'snippet', text, query });
  }
  private run(request: SearchProcessingRequest): Promise<SearchProcessingResponse> {
    if (typeof Worker === 'undefined')
      return new Promise((resolve) => setTimeout(() => resolve(processSearchText(request)), 0));
    return new Promise((resolve) => {
      this.pending.set(request.identifier, { request, resolve });
      try {
        if (!this.worker) {
          this.worker = new Worker(new URL('./search-worker.ts', import.meta.url), {
            type: 'module',
          });
          this.worker.onmessage = (event: MessageEvent<SearchProcessingResponse>) => {
            const task = this.pending.get(event.data.identifier);
            this.pending.delete(event.data.identifier);
            task?.resolve(event.data);
          };
          this.worker.onerror = (event) => {
            event.preventDefault();
            this.cancel({
              code: 'io-error',
              message: 'Could not run the search worker. Restart Anehalo and try again.',
              detail: event.message,
            });
          };
        }
        this.worker.postMessage(request);
      } catch (error) {
        this.cancel({
          code: 'io-error',
          message: 'Could not start note search.',
          detail: String(error),
        });
      }
    });
  }
  cancel(
    error: RepositoryError = { code: 'unavailable', message: 'Note search was interrupted.' },
  ) {
    this.worker?.terminate();
    this.worker = null;
    for (const { request, resolve } of this.pending.values())
      resolve({ identifier: request.identifier, kind: request.kind, result: failure(error) });
    this.pending.clear();
  }
}
