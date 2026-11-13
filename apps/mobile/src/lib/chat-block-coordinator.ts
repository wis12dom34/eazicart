import { createExclusiveMutationGate } from "./exclusive-mutation-gate";

export type ChatBlockScope = {
  accountId: string | null | undefined;
  conversationId: string | null | undefined;
  blockedByMe: boolean;
};

export type ChatBlockRequest = {
  expected: ChatBlockScope;
  currentScope: () => ChatBlockScope;
  changeBlocked: (conversationId: string, blocked: boolean) => Promise<unknown>;
  refresh: (accountId: string) => Promise<unknown>;
};

/** Protects a chat moderation confirmation from rapid taps and stale context.
 * This is a client-side action gate, not a replacement for server authorization.
 */
export function createChatBlockCoordinator() {
  const gate = createExclusiveMutationGate();
  let lastApplied: {
    accountId: string;
    conversationId: string;
    previous: boolean;
  } | null = null;

  function matches(a: ChatBlockScope, b: ChatBlockScope) {
    return (
      a.accountId === b.accountId &&
      a.conversationId === b.conversationId &&
      a.blockedByMe === b.blockedByMe
    );
  }

  return {
    get isBusy() {
      return gate.isBusy;
    },
    async confirm(request: ChatBlockRequest): Promise<{ started: boolean }> {
      const { expected } = request;
      if (
        !expected.accountId ||
        !expected.conversationId ||
        !matches(expected, request.currentScope())
      ) {
        return { started: false };
      }
      if (
        lastApplied?.accountId === expected.accountId &&
        lastApplied.conversationId === expected.conversationId &&
        lastApplied.previous === expected.blockedByMe
      ) {
        // A successful write can finish before React renders fresh server data.
        return { started: false };
      }
      return gate
        .run(async () => {
          // A different conversation/account may appear before the async handler starts.
          if (!matches(expected, request.currentScope())) return;
          await request.changeBlocked(
            expected.conversationId!,
            !expected.blockedByMe,
          );
          lastApplied = {
            accountId: expected.accountId!,
            conversationId: expected.conversationId!,
            previous: expected.blockedByMe,
          };
          const current = request.currentScope();
          if (
            current.accountId !== expected.accountId ||
            current.conversationId !== expected.conversationId
          )
            return;
          try {
            await request.refresh(expected.accountId!);
          } catch {
            // The action succeeded; a cache refresh failure is not a write failure.
          }
        })
        .then(({ started }) => ({ started }));
    },
  };
}
