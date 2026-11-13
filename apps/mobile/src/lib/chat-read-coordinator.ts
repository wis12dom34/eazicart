/** Account-scoped read-receipt queue.
 *
 * React Query's isPending state is not a synchronous lock. Coalesce
 * acknowledgements to the newest visible message while one is in flight,
 * and never invalidate an account's cache after switching sessions.
 */
export type ChatReadScope = {
  accountId: string | null | undefined;
  conversationId: string | null | undefined;
};
export type ChatReadRequest = ChatReadScope & {
  newestMessageId: string | null | undefined;
  currentScope: () => ChatReadScope;
  send: (conversationId: string) => Promise<unknown>;
  refresh: (accountId: string) => Promise<unknown>;
};

export function createChatReadCoordinator() {
  let busy = false;
  let latest: ChatReadRequest | null = null;
  let acknowledged: {
    accountId: string;
    conversationId: string;
    messageId: string;
  } | null = null;

  function current(request: ChatReadRequest) {
    const scope = request.currentScope();
    return (
      scope.accountId === request.accountId &&
      scope.conversationId === request.conversationId
    );
  }

  function alreadyRead(request: ChatReadRequest) {
    if (!acknowledged) return false;
    return (
      acknowledged.accountId === request.accountId &&
      acknowledged.conversationId === request.conversationId &&
      acknowledged.messageId === request.newestMessageId
    );
  }

  return {
    get isBusy() {
      return busy;
    },
    async acknowledge(request: ChatReadRequest): Promise<{ started: boolean }> {
      if (
        !request.accountId ||
        !request.conversationId ||
        !request.newestMessageId ||
        !current(request) ||
        alreadyRead(request)
      ) {
        return { started: false };
      }

      // Most recent acknowledgement wins; never create parallel read requests.
      latest = request;
      if (busy) return { started: false };
      busy = true;
      try {
        while (latest) {
          const next = latest;
          latest = null;
          if (!current(next) || alreadyRead(next)) continue;

          // When a read fails, don't spin on the same message. The next
          // explicit refresh/poll can retry, and new pending messages wait
          // for the following iteration.
          try {
            await next.send(next.conversationId!);
          } catch (error) {
            if (!latest) throw error;
            continue;
          }

          if (!current(next)) continue;
          acknowledged = {
            accountId: next.accountId!,
            conversationId: next.conversationId!,
            messageId: next.newestMessageId!,
          };
          try {
            // Read already succeeded: a cache refresh failure must not
            // produce duplicate acknowledgements.
            await next.refresh(next.accountId!);
          } catch {
            // A later poll refreshes conversation counts.
          }
        }
        return { started: true };
      } finally {
        busy = false;
      }
    },
  };
}

export function shouldShowConversationLoadError({
  messageError,
  hasMessageData,
  membershipError,
}: {
  messageError: boolean;
  hasMessageData: boolean;
  membershipError: boolean;
}) {
  // Older-page fetch errors must not discard already loaded conversations.
  return membershipError || (messageError && !hasMessageData);
}
