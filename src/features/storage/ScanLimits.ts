export interface ScanLimits {
  readonly maximumEntries: number;
  readonly maximumDurationMilliseconds: number;
  readonly batchSize: number;
  readonly maximumContentBytes: number;
}

export const defaultScanLimits: ScanLimits = {
  maximumEntries: 20_000,
  maximumDurationMilliseconds: 10_000,
  batchSize: 64,
  maximumContentBytes: 64 * 1024 * 1024,
};

export const scanLimitMessage = 'This folder has too many items to be a notes folder';
