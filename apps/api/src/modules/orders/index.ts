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
  fulfillments: Array<{ status: string; updatedAt: Date }>;
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

const fulfillmentBody = z.object({
  status: z.enum(["CONFIRMED", "FULFILLED", "CANCELLED"]),
});

const sellerOrderInclude = (sellerId: string) => ({
  user: { select: { name: true } },
  address: true,
  fulfillments: {
    where: { sellerId },
    select: { status: true, updatedAt: true },
    take: 1,
  },
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

const sellerOrderOutput = (order: SellerOrderRow) => {
  const fulfillment = order.fulfillments[0];
  if (!fulfillment)
    throw new AppError(
      409,
      "FULFILLMENT_NOT_FOUND",
      "Seller fulfillment state is unavailable",
    );
  return {
    id: order.id,
    status: fulfillment.status,
    globalStatus: order.status,
    createdAt: order.createdAt,
    updatedAt: fulfillment.updatedAt,
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
  };
};

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

const sellerForRequest = async (db: PrismaClient, uid: string) => {
  const seller = await db.sellerProfile.findUnique({
    where: { userId: uid },
    select: { id: true },
  });
  if (!seller)
    throw new AppError(403, "SELLER_REQUIRED", "Create a seller profile first");
  return seller;
};

const assertTransition = (current: string, next: string) => {
  if (current === next) return;
  const allowed =
    current === "PENDING"
      ? ["CONFIRMED", "CANCELLED"]
      : current === "CONFIRMED"
        ? ["FULFILLED", "CANCELLED"]
        : [];
  if (!allowed.includes(next))
    throw new AppError(
      409,
      "INVALID_FULFILLMENT_TRANSITION",
      `Cannot change seller fulfillment from ${current} to ${next}`,
    );
};

const sellerPaymentVisibility = {
  OR: [{ payment: null }, { payment: { status: "SUCCESS" as const } }],
};

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
    const seller = await sellerForRequest(db(), userId(r));
    const rows = await db().order.findMany({
      where: {
        fulfillments: { some: { sellerId: seller.id } },
        ...sellerPaymentVisibility,
      },
      include: sellerOrderInclude(seller.id),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: rows.map((row) => sellerOrderOutput(row)) };
  });

  app.get("/seller/orders/:id", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const seller = await sellerForRequest(db(), userId(r));
    const row = await db().order.findFirst({
      where: {
        id,
        fulfillments: { some: { sellerId: seller.id } },
        ...sellerPaymentVisibility,
      },
      include: sellerOrderInclude(seller.id),
    });
    if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    return { data: sellerOrderOutput(row) };
  });

  app.patch("/seller/orders/:id/fulfillment", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const { status } = fulfillmentBody.parse(r.body);
    const seller = await sellerForRequest(db(), userId(r));
    const current = await db().sellerFulfillment.findUnique({
      where: { orderId_sellerId: { orderId: id, sellerId: seller.id } },
      include: {
        order: { select: { payment: { select: { status: true } } } },
      },
    });
    if (!current) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (current.order.payment && current.order.payment.status !== "SUCCESS")
      throw new AppError(
        409,
        "PAYMENT_NOT_CONFIRMED",
        "Seller fulfillment cannot start before payment is confirmed",
      );
    assertTransition(current.status, status);
    if (current.status !== status) {
      await db().sellerFulfillment.update({
        where: { id: current.id },
        data: { status },
      });
    }
    const row = await db().order.findUnique({
      where: { id },
      include: sellerOrderInclude(seller.id),
    });
    if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    return { data: sellerOrderOutput(row) };
  });

  app.get("/seller/customers", auth, async (r) => {
    const seller = await sellerForRequest(db(), userId(r));
    const rows = await db().order.findMany({
      where: {
        items: { some: { product: { sellerId: seller.id } } },
        ...sellerPaymentVisibility,
      },
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
    const seller = await sellerForRequest(db(), userId(r));
    const rows = await db().order.findMany({
      where: {
        userId: id,
        items: { some: { product: { sellerId: seller.id } } },
        ...sellerPaymentVisibility,
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
        const sellerIds = Array.from(
          new Set(cart.items.map((item) => item.product.sellerId)),
        );
        await tx.sellerFulfillment.createMany({
          data: sellerIds.map((sellerId) => ({ orderId: order.id, sellerId })),
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
