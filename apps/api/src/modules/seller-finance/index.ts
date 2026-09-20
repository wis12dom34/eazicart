import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
import {
  getSellerPaidSummary,
  sellerFinanceSelect,
  sellerFinanceWhere,
  sellerOrderSubtotal,
} from "./summary.js";

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

    const summary = await getSellerPaidSummary(db(), seller.id);
    const recentOrders = await db().order.findMany({
      where: sellerFinanceWhere(seller.id),
      select: sellerFinanceSelect(seller.id),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
    const recentSales = recentOrders.flatMap((order) => {
      const payment = order.payment;
      const fulfillment = order.fulfillments[0];
      if (!payment || !fulfillment) return [];
      return [
        {
          orderId: order.id,
          fulfillmentStatus: fulfillment.status,
          subtotal: sellerOrderSubtotal(order.items).toString(),
          currency: payment.currency,
          paidAt: payment.paidAt,
        },
      ];
    });

    return {
      data: {
        ...summary,
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
