import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

type FulfillmentStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

type Totals = {
  paidGross: Prisma.Decimal;
  pendingGross: Prisma.Decimal;
  confirmedGross: Prisma.Decimal;
  fulfilledGross: Prisma.Decimal;
  cancelledGross: Prisma.Decimal;
};

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

export function registerSellerFinance(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);

  app.get("/seller/finance", protectedRoute(app), async (request) => {
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(request) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );

    const orders = await db().order.findMany({
      where: {
        payment: { status: "SUCCESS" },
        fulfillments: { some: { sellerId: seller.id } },
        items: { some: { product: { sellerId: seller.id } } },
      },
      select: {
        id: true,
        payment: { select: { currency: true, paidAt: true } },
        fulfillments: {
          where: { sellerId: seller.id },
          select: { status: true },
          take: 1,
        },
        items: {
          where: { product: { sellerId: seller.id } },
          select: { quantity: true, unitPrice: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalsByCurrency = new Map<string, Totals>();
    const recentSales = [] as Array<{
      orderId: string;
      fulfillmentStatus: FulfillmentStatus;
      subtotal: string;
      currency: string;
      paidAt: Date | null;
    }>;

    for (const order of orders) {
      const payment = order.payment;
      const fulfillment = order.fulfillments[0];
      if (!payment || !fulfillment) continue;
      const subtotal = order.items.reduce(
        (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      const totals = totalsByCurrency.get(payment.currency) ?? zeroTotals();
      totals.paidGross = totals.paidGross.add(subtotal);
      addStatusGross(totals, fulfillment.status, subtotal);
      totalsByCurrency.set(payment.currency, totals);
      if (recentSales.length < 20)
        recentSales.push({
          orderId: order.id,
          fulfillmentStatus: fulfillment.status,
          subtotal: subtotal.toString(),
          currency: payment.currency,
          paidAt: payment.paidAt,
        });
    }

    return {
      data: {
        paidOrders: orders.length,
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
        settlement: {
          platformFees: null,
          netEarnings: null,
          availableForPayout: null,
          payoutsEnabled: false,
        },
        recentSales,
      },
    };
  });
}
