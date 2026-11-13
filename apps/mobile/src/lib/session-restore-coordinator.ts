/**
 * Coalesces startup/session-recovery attempts for the same authentication
 * epoch. A late restore never changes UI state after logout or account switch.
 * Errors still propagate so callers can choose appropriate recovery UI.
 */
export function createSessionRestoreCoordinator() {
  let pending: { epoch: number; promise: Promise<void> } | null = null;

  return {
    run(
      epoch: number,
      isCurrent: (epoch: number) => boolean,
      restore: () => Promise<void>,
      onStart: () => void,
      onSettled: () => void,
    ): Promise<void> {
      if (!isCurrent(epoch)) return Promise.resolve();
      if (pending?.epoch === epoch) return pending.promise;
      onStart();
      const task = (async () => {
        try {
          await restore();
        } finally {
          if (isCurrent(epoch)) onSettled();
        }
      })();
      const tracked = task.finally(() => {
        if (pending?.epoch === epoch && pending.promise === tracked) {
          pending = null;
        }
      });
      pending = { epoch, promise: tracked };
      return tracked;
    },
  };
}
