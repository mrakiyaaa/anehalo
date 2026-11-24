import type { ImportReport } from './DiagramImportService';

export interface ImportNotice {
  readonly message: string;
  readonly error: boolean;
}

const maximumListed = 2;

/** The one toast shown after an import: what came in, and why anything was left out. */
export function summarizeImport(report: ImportReport): ImportNotice {
  const { imported, skipped } = report;
  if (imported.length === 1 && skipped.length === 0)
    return { message: `Imported “${imported[0]?.title ?? 'diagram'}”`, error: false };
  if (imported.length === 0 && skipped.length === 1)
    return { message: skipped[0]?.message ?? 'Nothing was imported.', error: true };
  if (skipped.length === 0) return { message: `${imported.length} imported`, error: false };
  const reasons = skipped
    .slice(0, maximumListed)
    .map(({ name, message }) => `${name}: ${message}`)
    .join(' ');
  const more = skipped.length > maximumListed ? ` and ${skipped.length - maximumListed} more` : '';
  return {
    message: `${imported.length} imported, ${skipped.length} skipped: ${reasons}${more}`,
    error: imported.length === 0,
  };
}
