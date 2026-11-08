import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { SearchResult } from './SearchEngine';
import { normalizedText, searchPlainText, searchSnippet } from './search-text';
import { markdownToPlainText } from '@/features/storage/note-snippet';

export interface AnalyzedSearchText {
  text: string;
  title: string;
  body: string;
}
export type SearchProcessingRequest =
  | { identifier: number; kind: 'preview'; markdown: string }
  | { identifier: number; kind: 'analyze'; title: string; markdown: string }
  | { identifier: number; kind: 'snippet'; text: string; query: string };
export type SearchProcessingResponse =
  | { identifier: number; kind: 'preview'; result: RepositoryResult<string> }
  | { identifier: number; kind: 'analyze'; result: RepositoryResult<AnalyzedSearchText> }
  | { identifier: number; kind: 'snippet'; result: RepositoryResult<SearchResult['snippet']> };

export function processSearchText(request: SearchProcessingRequest): SearchProcessingResponse {
  try {
    if (request.kind === 'preview')
      return {
        identifier: request.identifier,
        kind: 'preview',
        result: success(markdownToPlainText(request.markdown)),
      };
    if (request.kind === 'analyze') {
      const text = searchPlainText(request.markdown);
      return {
        identifier: request.identifier,
        kind: 'analyze',
        result: success({
          text,
          title: normalizedText(request.title).value,
          body: normalizedText(text).value,
        }),
      };
    }
    return {
      identifier: request.identifier,
      kind: 'snippet',
      result: success(searchSnippet(request.text, request.query)),
    };
  } catch (error) {
    return {
      identifier: request.identifier,
      kind: request.kind,
      result: failure(describeStorageError(error, 'Could not prepare note search text.')),
    };
  }
}
