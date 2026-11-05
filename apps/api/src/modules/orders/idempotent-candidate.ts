import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, userId } from "../shared.js";

/**
 * ISOLATED CANDIDATE: NOT registered in app.ts or production server.
 * Requires additive OrderIdempotency migration on a disposable database.
 *
 * The buyer-scoped Postgres advisory transaction lock serializes every order
 * submission for the same buyer, including submissions with different keys.
 * Unique (buyerId, key) persists the replay invariant across devices/restarts.
 */
const bodySchema = z
  .object({
    addressId: z.string().min(1),
    expectedTotal: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  })
  .strict();
const orderInclude = {
  address: true,
  items: { include: { product: { include: { images: { take: 1 } } } } },
} as const;
const output = <
  T extends {
    total: { toString(): string };
    items: Array<{ unitPrice: { toString(): string } }>;
  },
>(
  order: T,
) => ({
  ...order,
  total: order.total.toString(),
  items: order.items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice.toString(),
  })),
});
const isRetryable = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2034";

export async function createIdempotentOrderCandidate(
  db: PrismaClient,
  buyerId: string,
  raw: unknown,
) {
  const { addressId, expectedTotal, idempotencyKey } = bodySchema.parse(raw);
  if (!buyerId)
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  const expected = new Prisma.Decimal(expectedTotal);
  if (!expected.isFinite() || expected.lte(0))
    throw new AppError(400, "INVALID_TOTAL", "Expected total must be positive");

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // This lock is database-scoped and survives concurrent HTTP workers.
          // No lock across different buyers. Hash collision only serializes extra
          // buyers and cannot bypass the unique database constraints.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"eazicart:orders:" + buyerId}, 0))`;

          const previous = await tx.orderIdempotency.findUnique({
            where: { buyerId_key: { buyerId, key: idempotencyKey } },
          });
          if (previous) {
            if (
              previous.addressId !== addressId ||
              !previous.expectedTotal.equals(expected)
            )
              throw new AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "This checkout key belongs to a different request",
              );
            const order = await tx.order.findUnique({
              where: { id: previous.orderId, userId: buyerId },
              include: orderInclude,
            });
            if (!order)
              throw new AppError(
                409,
                "ORDER_UNAVAILABLE",
                "Saved checkout order is unavailable",
              );
            return { data: output(order), replayed: true };
          }

          const address = await tx.address.findFirst({
            where: { id: addressId, userId: buyerId },
          });
          if (!address)
            throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");

          const cart = await tx.cart.findUnique({
            where: { userId: buyerId },
            include: { items: { include: { product: true } } },
          });
          if (!cart?.items.length)
            throw new AppError(400, "EMPTY_CART", "Cart is empty");
          for (const item of cart.items) {
            if (
              !item.product.active ||
              item.quantity < 1 ||
              item.quantity > item.product.stock
            )
              throw new AppError(
                409,
                "PRODUCT_UNAVAILABLE",
                "A cart item is unavailable",
              );
          }

          const total = cart.items.reduce(
            (sum, item) => sum.add(item.product.price.mul(item.quantity)),
            new Prisma.Decimal(0),
          );
          if (!total.equals(expected))
            throw new AppError(
              409,
              "CART_TOTAL_CHANGED",
              "Cart prices changed",
            );
          const order = await tx.order.create({
            data: {
              userId: buyerId,
              addressId,
              total,
              items: {
                create: cart.items.map((item) => ({
                  productId: item.productId,
                  productName: item.product.name,
                  quantity: item.quantity,
                  unitPrice: item.product.price,
                })),
              },
            },
            include: orderInclude,
          });
          await tx.orderIdempotency.create({
            data: {
              buyerId,
              key: idempotencyKey,
              addressId,
              expectedTotal: expected,
              orderId: order.id,
            },
          });
          await tx.notification.create({
            data: {
              userId: buyerId,
              type: "ORDER",
              title: "Order received",
              body: "Your order was created. No payment has been taken.",
            },
          });
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          return { data: output(order), replayed: false };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (isRetryable(error) && attempt < 3) continue;
      if (isRetryable(error))
        throw new AppError(
          503,
          "ORDER_RETRY_REQUIRED",
          "Please retry with the same checkout key",
        );
      throw error;
    }
  }
  throw new AppError(
    503,
    "ORDER_RETRY_REQUIRED",
    "Please retry with the same checkout key",
  );
}

/** Explicit isolated registration ONLY, never imported from app.ts. */
export function registerIsolatedIdempotentOrderCandidate(
  app: FastifyInstance,
  db: PrismaClient,
) {
  const auth = protectedRoute(app);
  app.post("/preview/orders/idempotent", auth, async (request, reply) => {
    const result = await createIdempotentOrderCandidate(
      db,
      userId(request),
      request.body,
    );
    return reply.code(result.replayed ? 200 : 201).send(result);
  });
}
