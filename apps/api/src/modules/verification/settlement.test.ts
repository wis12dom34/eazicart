import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@eazicart/database";
import { activateSubscription, type VerifiedSettlement } from "./settlement.js";
const receipt: VerifiedSettlement = {
  provider: "KORAPAY",
  reference: "sub-only-ref",
  transactionId: "txn-1",
  accountId: "buyer-1",
  subscriptionId: "sub-1",
  planCode: "PRO",
  amountMinor: 250000n,
  currency: "NGN",
  status: "success",
  settledAt: new Date("2026-01-01"),
};
function fixture() {
  const subscription = {
    id: "sub-1",
    accountId: "buyer-1",
    seller: null,
    planCode: "PRO",
    status: "PENDING",
    startsAt: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-02-01"),
  };
  const intent = {
    id: "intent-1",
    ...receipt,
    status: "PENDING",
    providerTransactionId: null as string | null,
    subscription,
  };
  const tx = {
    payment: { findUnique: vi.fn().mockResolvedValue(null) },
    subscriptionPayment: {
      findUnique: vi.fn(() => Promise.resolve(intent)),
      updateMany: vi.fn(({ data }) => {
        Object.assign(intent, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    sellerSubscription: {
      updateMany: vi.fn(({ data }) => {
        Object.assign(subscription, data);
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const db = {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  return { db, tx, intent, subscription };
}
describe("isolated subscription settlement guard", () => {
  it("activates once and never extends a paid period on duplicate delivery", async () => {
    const f = fixture();
    const end = f.subscription.currentPeriodEnd;
    await activateSubscription(f.db, receipt);
    await activateSubscription(f.db, receipt);
    expect(f.tx.sellerSubscription.updateMany).toHaveBeenCalledTimes(1);
    expect(f.subscription.currentPeriodEnd).toEqual(end);
  });
  it.each([
    { accountId: "attacker" },
    { subscriptionId: "other" },
    { reference: "order-ref" },
    { provider: "PAYSTACK" },
    { planCode: "BUSINESS" },
    { amountMinor: 1n },
    { currency: "USD" },
    { status: "failed" },
    { settledAt: new Date("2099-01-01") },
  ])("rejects mismatched evidence %s", async (patch) => {
    const f = fixture();
    // findUnique must represent real reference matching in this fixture.
    if (patch.reference)
      f.tx.subscriptionPayment.findUnique.mockResolvedValueOnce(null as never);
    await expect(
      activateSubscription(f.db, {
        ...receipt,
        ...patch,
      } as VerifiedSettlement),
    ).rejects.toThrow();
    expect(f.tx.sellerSubscription.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a product-order reference even when a subscription intent exists", async () => {
    const f = fixture();
    f.tx.payment.findUnique.mockResolvedValueOnce({
      id: "historical-order-payment",
    });
    await expect(activateSubscription(f.db, receipt)).rejects.toThrow(
      "Order payment cannot settle a subscription",
    );
    expect(f.tx.subscriptionPayment.updateMany).not.toHaveBeenCalled();
    expect(f.tx.sellerSubscription.updateMany).not.toHaveBeenCalled();
  });
  it("rejects conflicting duplicate transactions", async () => {
    const f = fixture();
    await activateSubscription(f.db, receipt);
    await expect(
      activateSubscription(f.db, { ...receipt, transactionId: "other-txn" }),
    ).rejects.toThrow();
  });
});
