export const startupMarks = {
  scriptStarted: 'anehalo:script-started',
  windowShown: 'anehalo:window-shown',
  vaultReadStarted: 'anehalo:vault-read-start',
  vaultReadFinished: 'anehalo:vault-read-end',
  searchIndexStarted: 'anehalo:search-index-start',
  searchIndexFinished: 'anehalo:search-index-end',
  usable: 'anehalo:usable',
} as const;

export type StartupMark = (typeof startupMarks)[keyof typeof startupMarks];

export function hasStartupMark(mark: StartupMark): boolean {
  return performance.getEntriesByName(mark, 'mark').length > 0;
}

/** Later reloads and rescans repeat the same steps; only the first launch is the cold start. */
export function markStartupOnce(mark: StartupMark): void {
  if (!hasStartupMark(mark)) performance.mark(mark);
}
