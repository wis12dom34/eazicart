import type { PrismaClient } from "@eazicart/database";
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
  app.post("/seller-profile", protectedRoute(app), async (r, reply) => {
    const uid = userId(r);
    if (await db().sellerProfile.findUnique({ where: { userId: uid } }))
      throw new AppError(
        409,
        "SELLER_PROFILE_EXISTS",
        "Seller profile already exists",
      );
    return reply
      .code(201)
      .send({
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
