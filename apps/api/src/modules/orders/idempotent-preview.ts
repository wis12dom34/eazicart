import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, userId } from "../shared.js";

/**
 * UNREGISTERED /preview-only order writer. This file is deliberately NOT
 * imported by app.ts or server.ts and never changes the production /orders
 * handler. Requires the additive OrderIdempotency migration in an isolated DB.
 *
 * Production rollout would need separate, explicit approval.
 */

const inputSchema = z
  .object({
    addressId: z.string().min(1).max(128),
    expectedTotal: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
    cartSnapshot: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(128),
            quantity: z.number().int().positive().max(10_000),
            unitPrice: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

const include = {
  address: true,
  items: { include: { product: { include: { images: { take: 1 } } } } },
} as const;

type Input = {
  buyerId: string;
  key: string;
  addressId: string;
  expectedTotal: string;
  cartSnapshot: Array<{
    productId: string;
    quantity: number;
    unitPrice: string;
  }>;
};
const canonicalCart = (lines: Input["cartSnapshot"]) =>
  lines
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(item.unitPrice).toFixed(2),
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

const fingerprint = (input: Input) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        buyerId: input.buyerId,
        addressId: input.addressId,
        expectedTotal: new Prisma.Decimal(input.expectedTotal).toFixed(2),
        cartSnapshot: canonicalCart(input.cartSnapshot),
      }),
    )
    .digest("hex");

const conflict = () =>
  new AppError(
    409,
    "IDEMPOTENCY_KEY_REUSED",
    "This checkout key belongs to a different request. Refresh the cart and use a new key.",
  );
const retryable = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2034" || error.code === "P2002");

function serializeOrder<
  T extends {
    total: { toString(): string };
    items: Array<{ unitPrice: { toString(): string } }>;
  },
>(order: T) {
  return {
    ...order,
    total: order.total.toString(),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

export async function createPreviewIdempotentOrder(
  db: PrismaClient,
  input: Input,
) {
  const key = keySchema.parse(input.key);
  const body = inputSchema.parse({
    addressId: input.addressId,
    expectedTotal: input.expectedTotal,
    cartSnapshot: input.cartSnapshot,
  });
  const buyerId = input.buyerId;
  if (!buyerId)
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  const hash = fingerprint({ buyerId, key, ...body });

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const where = { buyerId_key: { buyerId, key } };
          const existing = await tx.orderIdempotency.findUnique({ where });
          if (existing) {
            if (existing.requestHash !== hash) throw conflict();
            if (!existing.orderId)
              throw new AppError(
                503,
                "ORDER_RECONCILIATION_REQUIRED",
                "Order reconciliation required",
              );
            const replayOrder = await tx.order.findFirst({
              where: { id: existing.orderId, userId: buyerId },
              include,
            });
            if (!replayOrder)
              throw new AppError(
                503,
                "ORDER_RECONCILIATION_REQUIRED",
                "Order reconciliation required",
              );
            // No writes, no cart read, no notification on replay.
            return { data: serializeOrder(replayOrder), replayed: true };
          }

          // Unique (buyerId, key) claim inside this same transaction.
          // On any failure this claim is rolled back with the order and cart.
          await tx.orderIdempotency.create({
            data: { buyerId, key, requestHash: hash },
          });
          const address = await tx.address.findFirst({
            where: { id: body.addressId, userId: buyerId },
            select: { id: true },
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
              item.quantity <= 0 ||
              item.quantity > item.product.stock
            )
              throw new AppError(
                409,
                "PRODUCT_UNAVAILABLE",
                "A cart item is unavailable",
              );
          }

          // Same total is not enough: checkout items and their server prices
          // must match the buyer's reviewed cart snapshot, irrespective of order.
          const serverCart = canonicalCart(
            cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price.toFixed(2),
            })),
          );
          if (
            JSON.stringify(serverCart) !==
            JSON.stringify(canonicalCart(body.cartSnapshot))
          )
            throw new AppError(
              409,
              "CART_CHANGED",
              "Cart contents changed. Review before ordering.",
            );

          const total = cart.items.reduce(
            (sum, item) => sum.add(item.product.price.mul(item.quantity)),
            new Prisma.Decimal(0),
          );
          if (!total.equals(new Prisma.Decimal(body.expectedTotal)))
            throw new AppError(
              409,
              "CART_PRICE_CHANGED",
              "Cart price changed. Review your total.",
            );

          const order = await tx.order.create({
            data: {
              userId: buyerId,
              addressId: address.id,
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
            include,
          });
          await tx.orderIdempotency.update({
            where,
            data: { orderId: order.id, completedAt: new Date() },
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
          return { data: serializeOrder(order), replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === 5)
        throw new AppError(
          503,
          "CHECKOUT_RETRY_REQUIRED",
          "Checkout is busy. Retry with the same idempotency key.",
        );
      // A committed competing transaction becomes visible on the next read.
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 18));
    }
  }
  throw new AppError(503, "CHECKOUT_RETRY_REQUIRED", "Retry with the same key");
}

export function registerIdempotentOrderPreview(
  app: FastifyInstance,
  db: PrismaClient,
) {
  const auth = protectedRoute(app);
  app.post("/preview/orders/idempotent", auth, async (request, reply) => {
    const buyerId = userId(request);
    const idempotencyKey = keySchema.parse(request.headers["idempotency-key"]);
    const body = inputSchema.parse(request.body);
    const result = await createPreviewIdempotentOrder(db, {
      buyerId,
      key: idempotencyKey,
      ...body,
    });
    return reply.code(result.replayed ? 200 : 201).send(result);
  });
}
