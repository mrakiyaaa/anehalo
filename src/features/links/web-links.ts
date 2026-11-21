import { openUrl } from '@tauri-apps/plugin-opener';
import { logFailure } from '@/features/diagnostics/error-logging';
import { isSafeLink } from '@/features/editor/sanitize-editor-html';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';

/** Whether a link is a web address Anehalo may hand to the default browser. */
export function isWebLink(link: string): boolean {
  return /^https?:\/\//i.test(link.trim()) && isSafeLink(link.trim());
}

/**
 * The only way Anehalo opens a web page: in the user's default browser. The app window itself
 * never navigates (the native side refuses it too), and nothing but http(s) is opened.
 */
export async function openWebLink(link: string): Promise<RepositoryResult<void>> {
  if (!isWebLink(link)) {
    logFailure('blocked-link');
    return failure({ code: 'invalid-path', message: 'Only web links can be opened in a browser.' });
  }
  try {
    await openUrl(link.trim());
    return success(undefined);
  } catch (error) {
    const result = failure(describeStorageError(error, 'Could not open the link in your browser.'));
    logFailure('web-link-failed');
    return result;
  }
}
