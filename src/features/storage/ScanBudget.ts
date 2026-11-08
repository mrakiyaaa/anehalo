import { StorageFailure } from './repository-result';
import { defaultScanLimits, scanLimitMessage, type ScanLimits } from './ScanLimits';

export interface ScanScheduling {
  readonly now: () => number;
  readonly yieldToInput: () => Promise<void>;
}

export const defaultScanScheduling: ScanScheduling = {
  now: () => performance.now(),
  yieldToInput: () =>
    new Promise((resolve) => {
      if (typeof MessageChannel === 'undefined') {
        setTimeout(resolve, 0);
        return;
      }
      // Hidden tray windows throttle timers; a message task still yields without that delay.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    }),
};

export class ScanBudget {
  private readonly started: number;
  private entries = 0;
  private contentBytes = 0;
  readonly limits: ScanLimits;

  constructor(
    limits = defaultScanLimits,
    private readonly scheduling = defaultScanScheduling,
  ) {
    this.limits = {
      maximumEntries: Math.max(
        1,
        Math.min(limits.maximumEntries, defaultScanLimits.maximumEntries),
      ),
      maximumDurationMilliseconds: Math.max(
        1,
        Math.min(limits.maximumDurationMilliseconds, defaultScanLimits.maximumDurationMilliseconds),
      ),
      batchSize: Math.max(1, Math.min(limits.batchSize, defaultScanLimits.batchSize)),
      maximumContentBytes: Math.max(
        1,
        Math.min(limits.maximumContentBytes, defaultScanLimits.maximumContentBytes),
      ),
    };
    this.started = scheduling.now();
  }

  get remainingMilliseconds() {
    return this.limits.maximumDurationMilliseconds - (this.scheduling.now() - this.started);
  }

  check() {
    if (this.remainingMilliseconds <= 0)
      throw new StorageFailure({ code: 'scan-limit', message: scanLimitMessage });
  }

  async entry() {
    this.check();
    if (++this.entries > this.limits.maximumEntries)
      throw new StorageFailure({ code: 'scan-limit', message: scanLimitMessage });
    if (this.entries % this.limits.batchSize === 0) await this.yield();
  }

  content(text: string) {
    this.contentBytes += text.length * 2;
    if (text.length > 8 * 1024 * 1024 || this.contentBytes > this.limits.maximumContentBytes)
      throw new StorageFailure({ code: 'scan-limit', message: scanLimitMessage });
    this.check();
  }

  async wait<Value>(operation: Promise<Value>): Promise<Value> {
    this.check();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new StorageFailure({ code: 'scan-limit', message: scanLimitMessage })),
            this.remainingMilliseconds,
          );
        }),
      ]);
      this.check();
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  async yield() {
    await this.wait(this.scheduling.yieldToInput());
  }
}
