/**
 * Serializes SecureStore writes and rejects results from a superseded session.
 * All invalidations happen synchronously, before any async storage work.
 */
export class SessionWriteGate {
  private epoch = 0;
  private tail: Promise<void> = Promise.resolve();

  capture(): number {
    return this.epoch;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.epoch;
  }

  invalidate(): number {
    return ++this.epoch;
  }

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  writeIfCurrent(
    epoch: number,
    operation: () => Promise<void>,
  ): Promise<boolean> {
    return this.enqueue(async () => {
      if (!this.isCurrent(epoch)) return false;
      await operation();
      return this.isCurrent(epoch);
    });
  }
}
