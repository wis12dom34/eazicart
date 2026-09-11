import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
const include = {
  address: true,
  items: { include: { product: { include: { images: { take: 1 } } } } },
};
const output = <
  T extends {
    total: { toString(): string };
    items: Array<{ unitPrice: { toString(): string } }>;
  },
>(
  x: T,
) => ({
  ...x,
  total: x.total.toString(),
  items: x.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString() })),
});
export function registerOrders(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app);
  app.get("/orders", auth, async (r) => ({
    data: (
      await db().order.findMany({
        where: { userId: userId(r) },
        include,
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ).map(output),
  }));
  app.get("/orders/:id", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const data = await db().order.findFirst({
      where: { id, userId: userId(r) },
      include,
    });
    if (!data) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    return { data: output(data) };
  });
  app.post("/orders", auth, async (r, reply) => {
    const { addressId } = z.object({ addressId: z.string() }).parse(r.body),
      uid = userId(r);
    const created = await db().$transaction(
      async (tx) => {
        if (
          !(await tx.address.findFirst({
            where: { id: addressId, userId: uid },
          }))
        )
          throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
        const cart = await tx.cart.findUnique({
          where: { userId: uid },
          include: { items: { include: { product: true } } },
        });
        if (!cart?.items.length)
          throw new AppError(400, "EMPTY_CART", "Cart is empty");
        for (const item of cart.items)
          if (!item.product.active || item.quantity > item.product.stock)
            throw new AppError(
              409,
              "PRODUCT_UNAVAILABLE",
              `${item.product.name} is unavailable`,
            );
        const total = cart.items.reduce(
          (s, i) => s.add(i.product.price.mul(i.quantity)),
          new Prisma.Decimal(0),
        );
        const order = await tx.order.create({
          data: {
            userId: uid,
            addressId,
            total,
            items: {
              create: cart.items.map((i) => ({
                productId: i.productId,
                productName: i.product.name,
                quantity: i.quantity,
                unitPrice: i.product.price,
              })),
            },
          },
          include,
        });
        await tx.notification.create({
          data: {
            userId: uid,
            type: "ORDER",
            title: "Order received",
            body: "Your order was created. No payment has been taken.",
          },
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return reply.code(201).send({ data: output(created) });
  });
}

