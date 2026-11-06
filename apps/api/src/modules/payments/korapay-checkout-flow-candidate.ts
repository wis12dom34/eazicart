import {
  initializeKoraCheckoutCandidate,
  verifyKoraChargeCandidate,
  type KoraFetcher,
} from "./korapay-api-adapter-candidate.js";

// Unregistered draft; no production database writes or routes.
export type OwnedKoraPayment = {
  orderId: string;
  buyerId: string;
  provider: string;
  reference: string;
  amountMinorUnits: string;
  currency: string;
  email: string;
  status: "PENDING" | "SUCCESS" | "REVIEW_REQUIRED" | "FAILED";
};
export type KoraStore = {
  findOwned(orderId: string, buyerId: string): Promise<OwnedKoraPayment | null>;
  // Production implementation must be atomic: only first successful transition
  // updates order, stock, fulfillment and notification in one serializable tx.
  settleOnce(
    payment: OwnedKoraPayment,
  ): Promise<"SETTLED" | "ALREADY_SETTLED" | "REVIEW_REQUIRED">;
};
export type KoraFlow = {
  status:
    | "CHECKOUT_READY"
    | "CONFIRMED"
    | "PENDING"
    | "REVIEW_REQUIRED"
    | "UNAVAILABLE";
  checkoutUrl?: string;
};
const unavailable = (): KoraFlow => ({ status: "UNAVAILABLE" });
const valid = (p: OwnedKoraPayment, orderId: string, buyerId: string) =>
  p.orderId === orderId &&
  p.buyerId === buyerId &&
  p.provider === "KORAPAY" &&
  p.currency === "NGN" &&
  /^EC-[A-Za-z0-9-]{8,80}$/.test(p.reference) &&
  /^\d+$/.test(p.amountMinorUnits) &&
  BigInt(p.amountMinorUnits) > 0n;
export async function beginKoraCheckoutCandidate(
  orderId: string,
  buyerId: string,
  store: KoraStore,
  secret: string,
  redirectUrl: string,
  fetcher: KoraFetcher,
  notificationUrl?: string,
): Promise<KoraFlow> {
  if (!orderId || !buyerId) return unavailable();
  const p = await store.findOwned(orderId, buyerId);
  if (!p || !valid(p, orderId, buyerId) || p.status !== "PENDING")
    return unavailable();
  const result = await initializeKoraCheckoutCandidate(
    {
      reference: p.reference,
      amountMinorUnits: p.amountMinorUnits,
      currency: p.currency,
      email: p.email,
      redirectUrl,
      notificationUrl,
    },
    secret,
    fetcher,
  );
  return result.ok
    ? { status: "CHECKOUT_READY", checkoutUrl: result.checkoutUrl }
    : unavailable();
}
export async function confirmKoraCheckoutCandidate(
  orderId: string,
  buyerId: string,
  store: KoraStore,
  secret: string,
  fetcher: KoraFetcher,
): Promise<KoraFlow> {
  if (!orderId || !buyerId) return unavailable();
  const p = await store.findOwned(orderId, buyerId);
  if (!p || !valid(p, orderId, buyerId)) return unavailable();
  if (p.status === "SUCCESS") return { status: "CONFIRMED" };
  if (p.status === "REVIEW_REQUIRED") return { status: "REVIEW_REQUIRED" };
  if (p.status !== "PENDING") return unavailable();
  const verified = await verifyKoraChargeCandidate(p, secret, fetcher);
  if (verified.status === "NOT_PAID") return { status: "PENDING" };
  if (verified.status !== "VERIFIED") return unavailable();
  const result = await store.settleOnce(p);
  return {
    status: result === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "CONFIRMED",
  };
}
