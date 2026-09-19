import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

function serializePlan(plan: {
  code: "BASIC" | "PRO" | "BUSINESS";
  name: string;
  monthlyPrice: { toString(): string } | null;
  productLimit: number | null;
  campaignLimit: number | null;
  advancedAnalytics: boolean | null;
  published: boolean;
  displayOrder: number;
}) {
  return {
    code: plan.code,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice?.toString() ?? null,
    productLimit: plan.productLimit,
    campaignLimit: plan.campaignLimit,
    advancedAnalytics: plan.advancedAnalytics,
    published: plan.published,
    displayOrder: plan.displayOrder,
    purchasable: plan.published && plan.monthlyPrice !== null,
  };
}

export function registerSellerSubscriptions(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);

  app.get("/seller/subscription/plans", protectedRoute(app), async () => ({
    data: (
      await db().sellerPlan.findMany({ orderBy: { displayOrder: "asc" } })
    ).map(serializePlan),
  }));

  app.get("/seller/subscription", protectedRoute(app), async (request) => {
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(request) },
      select: { id: true },
    });
    if (!seller) {
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    }

    const subscription = await db().sellerSubscription.findFirst({
      where: { sellerId: seller.id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              startsAt: subscription.startsAt,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelledAt: subscription.cancelledAt,
              createdAt: subscription.createdAt,
              updatedAt: subscription.updatedAt,
              plan: serializePlan(subscription.plan),
            }
          : null,
      },
    };
  });
}
