import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { SearchResult } from './SearchEngine';
import { normalizedText, searchPlainText, searchSnippet } from './search-text';
import { markdownToPlainText } from '@/features/storage/note-snippet';
import type { StoredElement } from '@/features/diagrams/DiagramContentScan';
import {
  extractDiagramSearchText,
  searchTextFromElements,
  type DiagramTextSegment,
} from './diagram-search-text';

export interface AnalyzedSearchText {
  text: string;
  title: string;
  body: string;
}
export interface AnalyzedDiagramText extends AnalyzedSearchText {
  segments: readonly DiagramTextSegment[];
}
/** A diagram's stored JSON, or its in-memory elements after a save. */
export type DiagramSource =
  { readonly json: string } | { readonly elements: readonly StoredElement[] };
export type SearchProcessingRequest =
  | { identifier: number; kind: 'preview'; markdown: string }
  | { identifier: number; kind: 'analyze'; title: string; markdown: string }
  | { identifier: number; kind: 'diagram'; title: string; source: DiagramSource }
  | { identifier: number; kind: 'snippet'; text: string; query: string };
export type SearchProcessingResponse =
  | { identifier: number; kind: 'preview'; result: RepositoryResult<string> }
  | { identifier: number; kind: 'analyze'; result: RepositoryResult<AnalyzedSearchText> }
  | { identifier: number; kind: 'diagram'; result: RepositoryResult<AnalyzedDiagramText> }
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
    if (request.kind === 'diagram') {
      const extracted =
        'json' in request.source
          ? extractDiagramSearchText(request.source.json)
          : searchTextFromElements(request.source.elements);
      return {
        identifier: request.identifier,
        kind: 'diagram',
        result: extracted
          ? success({
              text: extracted.text,
              segments: extracted.segments,
              title: normalizedText(request.title).value,
              body: normalizedText(extracted.text).value,
            })
          : failure({ code: 'invalid-diagram', message: 'The diagram file is not readable.' }),
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
