import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, userId } from "../shared.js";
import {
  confirmKoraCheckoutCandidate,
  type OwnedKoraPayment,
} from "./korapay-checkout-flow-candidate.js";
import type { KoraWebhookStore } from "./korapay-webhook-candidate.js";
import { createKoraPrismaStore } from "./korapay-prisma-settlement-candidate.js";
import type { KoraFetcher } from "./korapay-api-adapter-candidate.js";

// NOT REGISTERED in app.ts. Explicitly injectable for isolated preview tests only.
export type KoraPreviewCheckoutStore = KoraWebhookStore & {
  prepareOwned(orderId: string, buyerId: string): Promise<OwnedKoraPayment>;
};

const orderBody = z.object({ orderId: z.string().min(1) }).strict();
const orderParams = z.object({ orderId: z.string().min(1) });

export function createKoraPreviewCheckoutStore(
  db: PrismaClient,
): KoraPreviewCheckoutStore {
  const base = createKoraPrismaStore(db);
  return {
    ...base,
    async prepareOwned(orderId, buyerId) {
      const order = await db.order.findFirst({
        where: { id: orderId, userId: buyerId },
        include: {
          payment: true,
          user: { select: { email: true } },
          items: { select: { id: true } },
        },
      });
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
      if (order.status !== "PENDING" || order.items.length === 0)
        throw new AppError(409, "ORDER_NOT_PAYABLE", "Order is not payable");
      if (order.total.lte(0) || !order.total.isInteger())
        throw new AppError(
          409,
          "INVALID_KORA_AMOUNT",
          "Order total is not supported for Kora checkout",
        );

      // Each order has one payment row. Never overwrite or repurpose a
      // historical Paystack payment to change its provider or reference.
      let payment = order.payment;
      if (!payment) {
        try {
          payment = await db.payment.create({
            data: {
              orderId,
              provider: "KORAPAY",
              reference: `EC-${randomUUID()}`,
              status: "PENDING",
              amount: order.total,
              currency: "NGN",
            },
          });
        } catch (error) {
          // Concurrent creation on the unique orderId; re-read the winner.
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== "P2002"
          )
            throw error;
          payment = await db.payment.findUnique({ where: { orderId } });
        }
      }
      if (!payment || payment.provider !== "KORAPAY")
        throw new AppError(
          409,
          "PAYMENT_PROVIDER_CONFLICT",
          "This order uses another payment provider",
        );
      if (
        payment.status !== "PENDING" ||
        payment.currency !== "NGN" ||
        !payment.amount.equals(order.total)
      )
        throw new AppError(
          409,
          "PAYMENT_NOT_PENDING",
          "Payment is not pending for this order",
        );
      const owned = await base.findOwned(orderId, buyerId);
      if (!owned || owned.reference !== payment.reference)
        throw new AppError(
          409,
          "PAYMENT_CHANGED",
          "Payment changed; please retry",
        );
      return owned;
    },
  };
}

export function registerKoraPreviewCheckoutApi(
  app: FastifyInstance,
  deps: {
    store: KoraPreviewCheckoutStore;
    secret: string;
    fetcher: KoraFetcher;
    redirectUrl: string;
    notificationUrl: string;
    initializeOnce: (
      payment: OwnedKoraPayment,
      buyerId: string,
    ) => Promise<{ checkoutUrl: string; replayed: boolean }>;
  },
) {
  if (!deps.secret) throw new Error("Kora preview credentials required");
  const auth = protectedRoute(app);
  app.post("/preview/korapay/checkout", auth, async (request, reply) => {
    const { orderId } = orderBody.parse(request.body);
    const buyerId = userId(request);
    const payment = await deps.store.prepareOwned(orderId, buyerId);
    const result = await deps.initializeOnce(payment, buyerId);
    return reply.code(result.replayed ? 200 : 201).send({
      data: {
        orderId,
        reference: payment.reference,
        provider: "KORAPAY",
        status: "PENDING",
        currency: payment.currency,
        authorizationUrl: result.checkoutUrl,
      },
    });
  });
  app.get("/preview/korapay/orders/:orderId/verify", auth, async (request) => {
    const { orderId } = orderParams.parse(request.params);
    const buyerId = userId(request);
    const payment = await deps.store.findOwned(orderId, buyerId);
    if (!payment || payment.provider !== "KORAPAY")
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const flow = await confirmKoraCheckoutCandidate(
      orderId,
      buyerId,
      deps.store,
      deps.secret,
      deps.fetcher,
    );
    if (flow.status === "UNAVAILABLE")
      throw new AppError(
        503,
        "KORAPAY_VERIFICATION_UNAVAILABLE",
        "Payment verification is temporarily unavailable",
      );
    return {
      data: { orderId, reference: payment.reference, status: flow.status },
    };
  });
}
