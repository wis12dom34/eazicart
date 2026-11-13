/** Lock an account-changing native action synchronously at the event boundary.
 * React state updates are asynchronous: a second rapid tap can run before
 * a busy render. This gate is independent of render timing.
 * It does not provide backend idempotency or payment guarantees.
 */
export function createExclusiveMutationGate() {
  let busy = false;
  return {
    get isBusy() {
      return busy;
    },
    async run<T>(
      task: () => Promise<T>,
    ): Promise<{ started: true; value: T } | { started: false }> {
      if (busy) return { started: false };
      busy = true;
      try {
        return { started: true, value: await task() };
      } finally {
        busy = false;
      }
    },
  };
}
