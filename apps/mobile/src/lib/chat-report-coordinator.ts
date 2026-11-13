import { createExclusiveMutationGate } from "./exclusive-mutation-gate";

export type ChatReportReason = "SPAM" | "SCAM" | "HARASSMENT" | "OTHER";
export type ChatReportScope = {
  accountId: string | null | undefined;
  conversationId: string | null | undefined;
};
export type ChatReportPayload = {
  conversationId: string;
  reason: ChatReportReason;
  details: string;
};

export type ChatReportRequest = {
  scope: ChatReportScope;
  currentScope: () => ChatReportScope;
  reason: ChatReportReason | null;
  details: string;
  send: (payload: ChatReportPayload) => Promise<unknown>;
  confirmed: () => void;
};

const REASONS: ReadonlySet<string> = new Set([
  "SPAM",
  "SCAM",
  "HARASSMENT",
  "OTHER",
]);

/**
 * Synchronous, account- and conversation-scoped moderation report guard.
 * This prevents duplicate taps and stale UI effects, not backend duplicates
 * after an ambiguous network failure (the endpoint has no idempotency key).
 */
export function createChatReportCoordinator() {
  const gate = createExclusiveMutationGate();
  let submitted: { accountId: string; conversationId: string } | null = null;

  return {
    get isBusy() {
      return gate.isBusy;
    },
    async submit(request: ChatReportRequest): Promise<{ started: boolean }> {
      const { scope } = request;
      const trimmed = request.details.trim();
      const reason = request.reason;
      const isCurrent = () => {
        const now = request.currentScope();
        return (
          scope.accountId === now.accountId &&
          scope.conversationId === now.conversationId
        );
      };
      if (
        !scope.accountId ||
        !scope.conversationId ||
        !reason ||
        !REASONS.has(reason) ||
        trimmed.length > 1000 ||
        !isCurrent() ||
        (submitted?.accountId === scope.accountId &&
          submitted.conversationId === scope.conversationId)
      ) {
        return { started: false };
      }
      const payload: ChatReportPayload = {
        conversationId: scope.conversationId,
        reason,
        details: trimmed,
      };
      return gate
        .run(async () => {
          if (!isCurrent()) return;
          await request.send(payload);
          submitted = {
            accountId: scope.accountId!,
            conversationId: scope.conversationId!,
          };
          if (isCurrent()) request.confirmed();
        })
        .then(({ started }) => ({ started }));
    },
  };
}

/** A timed-out POST may have reached the server, so do not claim it failed. */
export function isUncertainChatReportError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = error.code;
  return code === "TIMEOUT" || code === "NETWORK_ERROR";
}
