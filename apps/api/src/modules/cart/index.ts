import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
const itemInclude = {
  product: {
    include: {
      images: { orderBy: { position: "asc" as const }, take: 1 },
      category: true,
      seller: true,
    },
  },
};
function view(cart: {
  id: string;
  items: Array<{
    id: string;
    quantity: number;
    product: { price: Prisma.Decimal };
  }>;
}) {
  const subtotal = cart.items.reduce(
    (sum, item) => sum.add(item.product.price.mul(item.quantity)),
    new Prisma.Decimal(0),
  );
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      unitPrice: item.product.price.toString(),
      lineTotal: item.product.price.mul(item.quantity).toString(),
      product: { ...item.product, price: item.product.price.toString() },
    })),
    subtotal: subtotal.toString(),
    total: subtotal.toString(),
  };
}
export function registerCart(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);
  app.get("/cart", auth, async (request) => {
    const cart = await db().cart.upsert({
      where: { userId: userId(request) },
      create: { userId: userId(request) },
      update: {},
      include: { items: { include: itemInclude } },
    });
    return { data: view(cart) };
  });
  app.post("/cart/items", auth, async (request, reply) => {
    const input = z
      .object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
      .parse(request.body);
    const product = await db().product.findFirst({
      where: { id: input.productId, active: true },
    });
    if (!product)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    const cart = await db().cart.upsert({
      where: { userId: userId(request) },
      create: { userId: userId(request) },
      update: {},
    });
    const existing = await db().cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    });
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    if (quantity > product.stock)
      throw new AppError(
        409,
        "INSUFFICIENT_STOCK",
        "Requested quantity is unavailable",
      );
    await db().cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      create: { cartId: cart.id, productId: product.id, quantity },
      update: { quantity },
    });
    const result = await db().cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: { items: { include: itemInclude } },
    });
    return reply.code(201).send({ data: view(result) });
  });
  app.patch("/cart/items/:itemId", auth, async (request) => {
    const { itemId } = z.object({ itemId: z.string() }).parse(request.params);
    const { quantity } = z
      .object({ quantity: z.number().int().positive() })
      .parse(request.body);
    const item = await db().cartItem.findFirst({
      where: { id: itemId, cart: { userId: userId(request) } },
      include: { product: true },
    });
    if (!item)
      throw new AppError(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
    if (quantity > item.product.stock)
      throw new AppError(
        409,
        "INSUFFICIENT_STOCK",
        "Requested quantity is unavailable",
      );
    await db().cartItem.update({ where: { id: item.id }, data: { quantity } });
    const cart = await db().cart.findUniqueOrThrow({
      where: { id: item.cartId },
      include: { items: { include: itemInclude } },
    });
    return { data: view(cart) };
  });
  app.delete("/cart/items/:itemId", auth, async (request, reply) => {
    const { itemId } = z.object({ itemId: z.string() }).parse(request.params);
    const result = await db().cartItem.deleteMany({
      where: { id: itemId, cart: { userId: userId(request) } },
    });
    if (!result.count)
      throw new AppError(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
    return reply.code(204).send();
  });
  app.delete("/cart", auth, async (request, reply) => {
    await db().cartItem.deleteMany({
      where: { cart: { userId: userId(request) } },
    });
    return reply.code(204).send();
  });
}
