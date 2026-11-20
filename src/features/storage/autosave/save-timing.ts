/** Quiet time after the last edit before a document is saved. */
export const SAVE_DEBOUNCE_MS = 500;

const FIRST_RETRY_MS = 1000;
const LONGEST_RETRY_MS = 30000;

/** A failed save is retried after 1 s, then 2 s, 4 s… up to 30 s between attempts. */
export function retryDelay(failedAttempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** failedAttempts, LONGEST_RETRY_MS);
}

export type SaveStatus = 'saving' | 'saved' | 'retrying';
