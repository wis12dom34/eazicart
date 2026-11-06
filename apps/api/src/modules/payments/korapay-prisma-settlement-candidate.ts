import { Prisma, type PrismaClient } from "@eazicart/database";
import type { OwnedKoraPayment } from "./korapay-checkout-flow-candidate.js";
import type { KoraWebhookStore } from "./korapay-webhook-candidate.js";

// UNREGISTERED DRAFT. Caller MUST verify charge directly with Kora before settleOnce.
// No live route calls this module. Never accept client-reported payment success.
class StockConflict extends Error {}
// P2034 is Prisma's serializable transaction write-conflict/deadlock code.
const retryable = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2034";
const minor = (amount: Prisma.Decimal) => amount.mul(100).toFixed(0);
export function createKoraPrismaStore(db: PrismaClient): KoraWebhookStore {
  return {
    async findByKoraReference(reference) {
      const payment = await db.payment.findUnique({
        where: { reference },
        select: {
          provider: true,
          orderId: true,
          order: { select: { userId: true } },
        },
      });
      return payment?.provider === "KORAPAY"
        ? { orderId: payment.orderId, buyerId: payment.order.userId }
        : null;
    },
    async findOwned(orderId, buyerId): Promise<OwnedKoraPayment | null> {
      const p = await db.payment.findFirst({
        where: { orderId, order: { userId: buyerId } },
        include: { order: { include: { user: { select: { email: true } } } } },
      });
      if (!p) return null;
      return {
        orderId: p.orderId,
        buyerId: p.order.userId,
        provider: p.provider,
        reference: p.reference,
        amountMinorUnits: minor(p.amount),
        currency: p.currency,
        email: p.order.user.email,
        status: p.status,
      };
    },
    async settleOnce(verified) {
      if (
        verified.provider !== "KORAPAY" ||
        verified.currency !== "NGN" ||
        !/^\d+$/.test(verified.amountMinorUnits) ||
        BigInt(verified.amountMinorUnits) <= 0n
      )
        throw new Error("Invalid verified Kora payment");
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          return await db.$transaction(
            async (tx) => {
              const p = await tx.payment.findFirst({
                where: {
                  reference: verified.reference,
                  orderId: verified.orderId,
                  provider: "KORAPAY",
                  currency: "NGN",
                  order: { userId: verified.buyerId },
                },
                include: {
                  order: {
                    include: {
                      items: {
                        include: { product: { select: { sellerId: true } } },
                      },
                    },
                  },
                },
              });
              if (!p || minor(p.amount) !== verified.amountMinorUnits)
                throw new Error("Payment identity or amount mismatch");
              if (p.status === "SUCCESS") return "ALREADY_SETTLED" as const;
              if (p.status === "REVIEW_REQUIRED")
                return "REVIEW_REQUIRED" as const;
              if (p.status !== "PENDING" || p.order.status !== "PENDING")
                throw new Error("Payment is not pending");
              // Conditional transition wins only once; losing concurrent calls must not touch stock.
              const claimed = await tx.payment.updateMany({
                where: {
                  id: p.id,
                  status: "PENDING",
                  provider: "KORAPAY",
                  reference: verified.reference,
                },
                data: {
                  status: "SUCCESS",
                  paidAt: new Date(),
                  failureReason: null,
                },
              });
              if (claimed.count !== 1)
                throw new Error("Payment transition conflict");
              for (const item of p.order.items) {
                const stock = await tx.product.updateMany({
                  where: {
                    id: item.productId,
                    active: true,
                    stock: { gte: item.quantity },
                  },
                  data: { stock: { decrement: item.quantity } },
                });
                if (stock.count !== 1) throw new StockConflict();
              }
              const sellers = [
                ...new Set(p.order.items.map((i) => i.product.sellerId)),
              ];
              await tx.sellerFulfillment.createMany({
                data: sellers.map((sellerId) => ({
                  orderId: p.orderId,
                  sellerId,
                })),
                skipDuplicates: true,
              });
              const order = await tx.order.updateMany({
                where: { id: p.orderId, status: "PENDING" },
                data: { status: "CONFIRMED" },
              });
              if (order.count !== 1)
                throw new Error("Order transition conflict");
              await tx.notification.create({
                data: {
                  userId: verified.buyerId,
                  type: "ORDER",
                  title: "Payment confirmed",
                  body: "Your payment was confirmed and your order is ready for seller processing.",
                },
              });
              return "SETTLED" as const;
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        } catch (error) {
          if (retryable(error)) {
            if (attempt === 3) throw error;
            // Bounded jitter-free retry: re-read current payment state in new tx.
            await new Promise((resolve) =>
              setTimeout(resolve, 10 * (attempt + 1)),
            );
            continue;
          }
          if (!(error instanceof StockConflict)) throw error;
          // Separate guarded transition records a paid-but-unfulfillable order for manual review.
          const marked = await db.payment.updateMany({
            where: {
              reference: verified.reference,
              orderId: verified.orderId,
              provider: "KORAPAY",
              status: "PENDING",
              order: { userId: verified.buyerId },
              amount: new Prisma.Decimal(verified.amountMinorUnits).div(100),
              currency: "NGN",
            },
            data: {
              status: "REVIEW_REQUIRED",
              paidAt: new Date(),
              failureReason:
                "Verified payment: insufficient inventory; manual review required",
            },
          });
          if (marked.count !== 1) throw new Error("Review transition conflict");
          return "REVIEW_REQUIRED" as const;
        }
      }
      throw new Error("Kora settlement retry limit exceeded");
    },
  };
}
