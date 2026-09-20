import { Prisma, type PrismaClient } from "@eazicart/database";

type FulfillmentStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

type Totals = {
  paidGross: Prisma.Decimal;
  pendingGross: Prisma.Decimal;
  confirmedGross: Prisma.Decimal;
  fulfilledGross: Prisma.Decimal;
  cancelledGross: Prisma.Decimal;
};

export type SellerFinanceTotal = {
  currency: string;
  paidGross: string;
  pendingGross: string;
  confirmedGross: string;
  fulfilledGross: string;
  cancelledGross: string;
};

const financeBatchSize = 250;

const zeroTotals = (): Totals => ({
  paidGross: new Prisma.Decimal(0),
  pendingGross: new Prisma.Decimal(0),
  confirmedGross: new Prisma.Decimal(0),
  fulfilledGross: new Prisma.Decimal(0),
  cancelledGross: new Prisma.Decimal(0),
});

const addStatusGross = (
  totals: Totals,
  status: FulfillmentStatus,
  amount: Prisma.Decimal,
) => {
  if (status === "PENDING")
    totals.pendingGross = totals.pendingGross.add(amount);
  if (status === "CONFIRMED")
    totals.confirmedGross = totals.confirmedGross.add(amount);
  if (status === "FULFILLED")
    totals.fulfilledGross = totals.fulfilledGross.add(amount);
  if (status === "CANCELLED")
    totals.cancelledGross = totals.cancelledGross.add(amount);
};

export const sellerFinanceWhere = (sellerId: string) => ({
  payment: { status: "SUCCESS" as const },
  fulfillments: { some: { sellerId } },
  items: { some: { product: { sellerId } } },
});

export const sellerFinanceSelect = (sellerId: string) => ({
  id: true,
  payment: { select: { currency: true, paidAt: true } },
  fulfillments: {
    where: { sellerId },
    select: { status: true },
    take: 1,
  },
  items: {
    where: { product: { sellerId } },
    select: { quantity: true, unitPrice: true },
  },
});

export const sellerOrderSubtotal = (
  items: Array<{ quantity: number; unitPrice: Prisma.Decimal }>,
) =>
  items.reduce(
    (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

export async function getSellerPaidSummary(
  db: PrismaClient,
  sellerId: string,
): Promise<{ paidOrders: number; totals: SellerFinanceTotal[] }> {
  const where = sellerFinanceWhere(sellerId);
  const totalsByCurrency = new Map<string, Totals>();
  let paidOrders = 0;
  let cursor: string | undefined;

  while (true) {
    const orders = await db.order.findMany({
      where,
      select: sellerFinanceSelect(sellerId),
      orderBy: { id: "asc" },
      take: financeBatchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (!orders.length) break;

    for (const order of orders) {
      const payment = order.payment;
      const fulfillment = order.fulfillments[0];
      if (!payment || !fulfillment) continue;

      const subtotal = sellerOrderSubtotal(order.items);
      const totals = totalsByCurrency.get(payment.currency) ?? zeroTotals();
      totals.paidGross = totals.paidGross.add(subtotal);
      addStatusGross(totals, fulfillment.status, subtotal);
      totalsByCurrency.set(payment.currency, totals);
      paidOrders += 1;
    }

    if (orders.length < financeBatchSize) break;
    cursor = orders[orders.length - 1]?.id;
    if (!cursor) break;
  }

  return {
    paidOrders,
    totals: Array.from(totalsByCurrency.entries()).map(
      ([currency, totals]) => ({
        currency,
        paidGross: totals.paidGross.toString(),
        pendingGross: totals.pendingGross.toString(),
        confirmedGross: totals.confirmedGross.toString(),
        fulfilledGross: totals.fulfilledGross.toString(),
        cancelledGross: totals.cancelledGross.toString(),
      }),
    ),
  };
}
