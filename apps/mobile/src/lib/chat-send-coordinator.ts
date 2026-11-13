import { createExclusiveMutationGate } from "./exclusive-mutation-gate";

export type ChatSendPayload = {
  body: string;
  key: string;
  productId?: string;
};

type Scope = { accountId: string; conversationId: string };
type SendOptions = {
  accountId?: string | null;
  conversationId: string;
  body: string;
  productId?: string | null;
  blocked?: boolean;
  currentScope: () => { accountId?: string | null; conversationId: string };
  makeKey: () => string;
  send: (payload: ChatSendPayload) => Promise<unknown>;
  confirmed: (payload: ChatSendPayload) => void;
};

export function createChatSendCoordinator() {
  const gate = createExclusiveMutationGate();
  let retry: { scope: Scope; signature: string; key: string } | null = null;

  return {
    get isBusy() {
      return gate.isBusy;
    },
    async submit(options: SendOptions): Promise<{ started: boolean }> {
      const body = options.body.trim();
      if (
        !options.accountId ||
        !options.conversationId ||
        options.blocked ||
        (!body && !options.productId) ||
        body.length > 4000 ||
        gate.isBusy
      ) {
        return { started: false };
      }
      const scope: Scope = {
        accountId: options.accountId,
        conversationId: options.conversationId,
      };
      const sameScope = () => {
        const current = options.currentScope();
        return (
          current.accountId === scope.accountId &&
          current.conversationId === scope.conversationId
        );
      };
      if (!sameScope()) return { started: false };

      const signature = JSON.stringify([body, options.productId ?? null]);
      const existing =
        retry?.scope.accountId === scope.accountId &&
        retry.scope.conversationId === scope.conversationId &&
        retry.signature === signature
          ? retry.key
          : null;
      const key = existing ?? options.makeKey();
      const payload: ChatSendPayload = {
        body,
        key,
        ...(options.productId ? { productId: options.productId } : {}),
      };
      return gate
        .run(async () => {
          // Keep retry ID on uncertain network failures, but never on a
          // changed message, different chat or different authenticated account.
          retry = { scope, signature, key };
          await options.send(payload);
          retry = null;
          // Old requests must not clear the new account's composer/cache.
          if (sameScope()) options.confirmed(payload);
        })
        .then(({ started }) => ({ started }));
    },
  };
}
