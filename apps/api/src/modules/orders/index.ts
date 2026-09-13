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

type SellerOrderRow = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string };
  address: {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
    userId: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    product: {
      id: string;
      images: Array<{
        id: string;
        url: string;
        altText: string | null;
        position: number;
        productId: string;
      }>;
    };
  }>;
};

type SellerCustomerOrderRow = {
  id: string;
  status: string;
  createdAt: Date;
  user: { id: string; name: string };
  address: { city: string; region: string; country: string };
  items: Array<{ productName: string; quantity: number }>;
};

const sellerOrderInclude = (sellerId: string) => ({
  user: { select: { name: true } },
  address: true,
  items: {
    where: { product: { sellerId } },
    include: {
      product: {
        select: {
          id: true,
          images: { orderBy: { position: "asc" as const }, take: 1 },
        },
      },
    },
  },
});

const sellerOrderOutput = (order: SellerOrderRow) => ({
  id: order.id,
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  customer: { name: order.user.name },
  address: order.address,
  subtotal: order.items
    .reduce(
      (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
      new Prisma.Decimal(0),
    )
    .toString(),
  items: order.items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice.toString(),
  })),
});

const sellerCustomerSelect = (sellerId: string) => ({
  id: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  address: { select: { city: true, region: true, country: true } },
  items: {
    where: { product: { sellerId } },
    select: { productName: true, quantity: true },
  },
});

const sellerCustomerOutput = (orders: SellerCustomerOrderRow[]) => {
  const latest = orders[0];
  const earliest = orders.at(-1);
  if (!latest || !earliest)
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  return {
    id: latest.user.id,
    name: latest.user.name,
    orders: orders.length,
    units: orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    ),
    firstOrderAt: earliest.createdAt,
    latestOrderAt: latest.createdAt,
    location: latest.address,
  };
};

const sellerCustomerOrderOutput = (order: SellerCustomerOrderRow) => ({
  id: order.id,
  status: order.status,
  createdAt: order.createdAt,
  units: order.items.reduce((sum, item) => sum + item.quantity, 0),
  items: order.items,
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
  app.get("/seller/orders", auth, async (r) => {
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(r) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    const rows = await db().order.findMany({
      where: { items: { some: { product: { sellerId: seller.id } } } },
      include: sellerOrderInclude(seller.id),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: rows.map((row) => sellerOrderOutput(row)) };
  });
  app.get("/seller/orders/:id", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(r) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    const row = await db().order.findFirst({
      where: {
        id,
        items: { some: { product: { sellerId: seller.id } } },
      },
      include: sellerOrderInclude(seller.id),
    });
    if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    return { data: sellerOrderOutput(row) };
  });
  app.get("/seller/customers", auth, async (r) => {
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(r) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    const rows = await db().order.findMany({
      where: { items: { some: { product: { sellerId: seller.id } } } },
      select: sellerCustomerSelect(seller.id),
      orderBy: { createdAt: "desc" },
    });
    const grouped = new Map<string, SellerCustomerOrderRow[]>();
    for (const row of rows) {
      const current = grouped.get(row.user.id) ?? [];
      current.push(row);
      grouped.set(row.user.id, current);
    }
    return {
      data: Array.from(grouped.values()).map((orders) =>
        sellerCustomerOutput(orders),
      ),
    };
  });
  app.get("/seller/customers/:id", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(r) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    const rows = await db().order.findMany({
      where: {
        userId: id,
        items: { some: { product: { sellerId: seller.id } } },
      },
      select: sellerCustomerSelect(seller.id),
      orderBy: { createdAt: "desc" },
    });
    if (!rows.length)
      throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    return {
      data: {
        customer: sellerCustomerOutput(rows),
        orders: rows.map((order) => sellerCustomerOrderOutput(order)),
      },
    };
  });
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
