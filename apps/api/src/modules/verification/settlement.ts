import { Prisma, type PrismaClient } from "@eazicart/database";

/** Internal adapter contract: must come from authenticated provider verification,
 * never directly from a webhook body or client request. No route calls this yet.
 */
export type VerifiedSettlement = {
  provider: "KORAPAY" | "PAYSTACK";
  reference: string;
  transactionId: string;
  accountId: string;
  subscriptionId: string;
  planCode: "PRO" | "BUSINESS";
  amountMinor: bigint;
  currency: string;
  status: "success";
  settledAt: Date;
};

export async function activateSubscription(
  db: PrismaClient,
  receipt: VerifiedSettlement,
) {
  return db.$transaction(
    async (tx) => {
      const intent = await tx.subscriptionPayment.findUnique({
        where: { reference: receipt.reference },
        include: {
          subscription: { include: { seller: { select: { userId: true } } } },
        },
      });
      if (!intent) throw new Error("Unknown subscription payment");
      // A reference already assigned to a product order cannot be repurposed,
      // even if a malformed subscription intent was later created for it.
      const orderPayment = await tx.payment.findUnique({
        where: { reference: receipt.reference },
        select: { id: true },
      });
      if (orderPayment)
        throw new Error("Order payment cannot settle a subscription");
      const sub = intent.subscription;
      const owner = sub.accountId ?? sub.seller?.userId;
      if (
        receipt.status !== "success" ||
        !receipt.transactionId ||
        !["KORAPAY", "PAYSTACK"].includes(receipt.provider) ||
        intent.provider !== receipt.provider ||
        intent.accountId !== receipt.accountId ||
        owner !== receipt.accountId ||
        sub.id !== receipt.subscriptionId ||
        intent.planCode !== receipt.planCode ||
        sub.planCode !== receipt.planCode ||
        intent.amountMinor <= 0n ||
        intent.amountMinor !== receipt.amountMinor ||
        intent.currency !== receipt.currency ||
        !Number.isFinite(receipt.settledAt.getTime()) ||
        receipt.settledAt > new Date() ||
        !sub.startsAt ||
        !sub.currentPeriodEnd ||
        sub.startsAt >= sub.currentPeriodEnd
      )
        throw new Error("Subscription settlement mismatch");
      if (intent.status === "SUCCESS") {
        if (intent.providerTransactionId !== receipt.transactionId)
          throw new Error("Conflicting transaction");
        return sub; // Replay never changes dates or removes suspension/cancellation.
      }
      if (intent.status !== "PENDING" || sub.status !== "PENDING")
        throw new Error("Subscription intent is not pending");
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: intent.id, status: "PENDING" },
        data: {
          status: "SUCCESS",
          providerTransactionId: receipt.transactionId,
          settledAt: receipt.settledAt,
        },
      });
      if (claimed.count !== 1)
        throw new Error("Concurrent settlement; retry verification");
      const activated = await tx.sellerSubscription.updateMany({
        where: { id: sub.id, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
      if (activated.count !== 1)
        throw new Error("Subscription changed; retry verification");
      return { ...sub, status: "ACTIVE" as const };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
