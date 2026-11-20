/** Runs tasks strictly one after another, so saves of one document never overlap. */
export class SerialTaskQueue {
  private tail: Promise<void> = Promise.resolve();

  run<Value>(task: () => Promise<Value>): Promise<Value> {
    const result = this.tail.then(task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Resolves once everything queued so far has finished. */
  idle(): Promise<void> {
    return this.tail;
  }
}
