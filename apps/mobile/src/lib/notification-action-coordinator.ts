import { createExclusiveMutationGate } from "./exclusive-mutation-gate";

/** Serialize all notification write actions without trusting render-time busy flags.
 * A successful request refreshes only the still-current signed-in user's cache.
 */
export function createNotificationActionCoordinator() {
  const gate = createExclusiveMutationGate();

  return {
    get isBusy() {
      return gate.isBusy;
    },
    run(
      accountId: string | null | undefined,
      currentAccountId: () => string | null | undefined,
      action: () => Promise<unknown>,
      refresh: () => Promise<unknown>,
    ): Promise<{ started: boolean }> {
      if (!accountId || currentAccountId() !== accountId) {
        return Promise.resolve({ started: false });
      }
      return gate
        .run(async () => {
          if (currentAccountId() !== accountId) return;
          await action();
          // Logout and account switching must not trigger a stale cache refresh.
          if (currentAccountId() === accountId) await refresh();
        })
        .then((result) => ({ started: result.started }));
    },
  };
}
