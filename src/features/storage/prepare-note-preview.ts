import { SearchTextProcessor } from '@/features/search/SearchTextProcessor';
import type { ScanBudget } from './ScanBudget';
import { markdownToPlainText } from './note-snippet';
import { StorageFailure } from './repository-result';

export async function prepareNotePreview(
  content: string,
  processor: SearchTextProcessor,
  budget: ScanBudget,
): Promise<string> {
  budget.content(content);
  if (content.length <= 8192) return markdownToPlainText(content);
  const response = await budget.wait(processor.preview(content));
  if (response.kind !== 'preview')
    throw new StorageFailure({ code: 'io-error', message: 'Could not prepare the note preview.' });
  if (!response.result.ok) throw new StorageFailure(response.result.error);
  return response.result.value;
}
