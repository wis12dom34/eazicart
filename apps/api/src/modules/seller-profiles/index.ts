import type { Prisma, PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
const body = z.object({
  displayName: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(2000).nullable().optional(),
});
const include = {
  user: { select: { id: true, name: true } },
  _count: { select: { products: { where: { active: true } } } },
};
export function registerSellerProfiles(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);
  app.get("/sellers", async () => ({
    data: await db().sellerProfile.findMany({
      include,
      orderBy: { displayName: "asc" },
      take: 100,
    }),
  }));
  app.get("/sellers/:id", async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const data = await db().sellerProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include,
    });
    if (!data) throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    return {
      data: {
        ...data,
        followerCount: await db().follow.count({
          where: { sellerId: data.userId },
        }),
      },
    };
  });
  app.get("/sellers/:id/products", async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    return {
      data: await db().product.findMany({
        where: { active: true, seller: { OR: [{ id }, { userId: id }] } },
        include: { images: true, category: true, seller: true },
        take: 100,
      }),
    };
  });
  app.get("/seller/dashboard", protectedRoute(app), async (r) => {
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(r) },
      select: { id: true, displayName: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );

    const sellerOrderWhere: Prisma.OrderWhereInput = {
      items: { some: { product: { sellerId: seller.id } } },
    };
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      stockSummary,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      fulfilledOrders,
      cancelledOrders,
      customers,
    ] = await Promise.all([
      db().product.count({ where: { sellerId: seller.id } }),
      db().product.count({ where: { sellerId: seller.id, active: true } }),
      db().product.count({
        where: { sellerId: seller.id, active: true, stock: 0 },
      }),
      db().product.aggregate({
        where: { sellerId: seller.id, active: true },
        _sum: { stock: true },
      }),
      db().order.count({ where: sellerOrderWhere }),
      db().order.count({
        where: { ...sellerOrderWhere, status: "PENDING" },
      }),
      db().order.count({
        where: { ...sellerOrderWhere, status: "CONFIRMED" },
      }),
      db().order.count({
        where: { ...sellerOrderWhere, status: "FULFILLED" },
      }),
      db().order.count({
        where: { ...sellerOrderWhere, status: "CANCELLED" },
      }),
      db().order.findMany({
        where: sellerOrderWhere,
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    return {
      data: {
        seller,
        inventory: {
          totalProducts,
          activeProducts,
          outOfStockProducts,
          unitsInStock: stockSummary._sum.stock ?? 0,
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          confirmed: confirmedOrders,
          fulfilled: fulfilledOrders,
          cancelled: cancelledOrders,
        },
        customers: { total: customers.length },
        analytics: {
          revenue: null,
          productViews: null,
          impressions: null,
          profileVisits: null,
          clicks: null,
          conversionRate: null,
        },
      },
    };
  });
  app.post("/seller-profile", protectedRoute(app), async (r, reply) => {
    const uid = userId(r);
    if (await db().sellerProfile.findUnique({ where: { userId: uid } }))
      throw new AppError(
        409,
        "SELLER_PROFILE_EXISTS",
        "Seller profile already exists",
      );
    return reply.code(201).send({
      data: await db().sellerProfile.create({
        data: { ...body.parse(r.body), userId: uid },
        include,
      }),
    });
  });
  app.patch("/seller-profile", protectedRoute(app), async (r) => {
    const uid = userId(r);
    if (!(await db().sellerProfile.findUnique({ where: { userId: uid } })))
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller profile not found");
    return {
      data: await db().sellerProfile.update({
        where: { userId: uid },
        data: body.partial().parse(r.body),
        include,
      }),
    };
  });
}
