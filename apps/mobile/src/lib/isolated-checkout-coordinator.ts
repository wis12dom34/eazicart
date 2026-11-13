import { canCheckoutReview, cartFingerprint, hasCartChanged } from "./commerce";
import type { Address, Cart } from "./types";
import {
  readKoraSession,
  readKoraVerification,
  type KoraCheckoutSession,
  type KoraVerifyResult,
} from "./checkout-safety";

export type CheckoutIntent = {
  buyerId: string;
  addressId: string;
  idempotencyKey: string;
  reviewedCart: Cart;
};
export type IsolatedBackendOrder = {
  id: string;
  buyerId: string;
  total: string;
};

/**
 * Explicitly dependency-injected fixture interface. No production network
 * adapter is supplied by this application. Production backend MUST enforce
 * idempotency keys atomically before this could ever become a live flow.
 */
export type IsolatedCheckoutBackend = {
  cart: () => Promise<Cart>;
  addresses: () => Promise<Address[]>;
  createOrder: (args: {
    addressId: string;
    expectedTotal: string;
    idempotencyKey: string;
  }) => Promise<IsolatedBackendOrder>;
  initializeKora: (args: {
    orderId: string;
    idempotencyKey: string;
  }) => Promise<unknown>;
  verifyKora: (args: { orderId: string }) => Promise<unknown>;
};
export type PreparedCheckout = {
  status: "READY";
  session: KoraCheckoutSession;
};
export type BlockedCheckout = {
  status: "BLOCKED";
  reason:
    | "INVALID_INTENT"
    | "CART_CHANGED"
    | "ADDRESS_NOT_FOUND"
    | "ORDER_MISMATCH"
    | "INVALID_PAYMENT_SESSION";
};
type Result = PreparedCheckout | BlockedCheckout;

const blocked = (reason: BlockedCheckout["reason"]): BlockedCheckout => ({
  status: "BLOCKED",
  reason,
});
const isSafeKey = (key: string) => /^[A-Za-z0-9_-]{16,128}$/.test(key);

/**
 * In-memory deduplication protects against repeated taps and in-session
 * retries. It does NOT provide durable exactly-once order semantics; only an
 * idempotent, transactional backend can do that. Never use in production.
 */
export function createIsolatedCheckoutCoordinator(
  backend: IsolatedCheckoutBackend,
) {
  const pending = new Map<string, Promise<Result>>();
  const prepared = new Map<string, PreparedCheckout>();
  const orders = new Map<string, IsolatedBackendOrder>();
  const fingerprints = new Map<string, string>();

  async function prepare(intent: CheckoutIntent): Promise<Result> {
    if (
      !intent.buyerId ||
      !intent.addressId ||
      !isSafeKey(intent.idempotencyKey)
    )
      return blocked("INVALID_INTENT");
    const scopedKey = `${intent.buyerId}:${intent.idempotencyKey}`;
    const intentSignature = JSON.stringify({
      buyerId: intent.buyerId,
      addressId: intent.addressId,
      cartFingerprint: cartFingerprint(intent.reviewedCart),
    });
    const previous = fingerprints.get(scopedKey);
    if (previous && previous !== intentSignature)
      return blocked("INVALID_INTENT");
    fingerprints.set(scopedKey, intentSignature);

    const ready = prepared.get(scopedKey);
    if (ready) return ready;
    const sameRequest = pending.get(scopedKey);
    if (sameRequest) return sameRequest;

    const work = (async (): Promise<Result> => {
      if (!canCheckoutReview(intent.reviewedCart))
        return blocked("INVALID_INTENT");
      const [latest, addresses] = await Promise.all([
        backend.cart(),
        backend.addresses(),
      ]);
      if (
        hasCartChanged(intent.reviewedCart, latest) ||
        !canCheckoutReview(latest)
      )
        return blocked("CART_CHANGED");
      if (!addresses.some((address) => address.id === intent.addressId))
        return blocked("ADDRESS_NOT_FOUND");

      let order = orders.get(scopedKey);
      if (!order) {
        // Fixture backend must enforce the key atomically, not just the client.
        order = await backend.createOrder({
          addressId: intent.addressId,
          expectedTotal: latest.total,
          idempotencyKey: intent.idempotencyKey,
        });
        if (
          order.buyerId !== intent.buyerId ||
          order.total !== latest.total ||
          !order.id
        )
          return blocked("ORDER_MISMATCH");
        orders.set(scopedKey, order);
      }
      const result = await backend.initializeKora({
        orderId: order.id,
        idempotencyKey: intent.idempotencyKey,
      });
      const session = readKoraSession(result, order.id);
      if (!session) return blocked("INVALID_PAYMENT_SESSION");
      const completed: PreparedCheckout = { status: "READY", session };
      prepared.set(scopedKey, completed);
      return completed;
    })();

    pending.set(scopedKey, work);
    try {
      return await work;
    } finally {
      if (pending.get(scopedKey) === work) pending.delete(scopedKey);
    }
  }

  async function verify(
    session: KoraCheckoutSession,
  ): Promise<KoraVerifyResult | null> {
    const remote = await backend.verifyKora({ orderId: session.orderId });
    return readKoraVerification(remote, session);
  }

  return { prepare, verify };
}
