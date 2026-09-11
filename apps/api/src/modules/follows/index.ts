import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
export function registerFollows(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app),
    p = z.object({ sellerId: z.string() });
  app.get("/following", auth, async (r) => ({
    data: await db().follow.findMany({
      where: { followerId: userId(r) },
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { id: true, name: true, sellerProfile: true } },
      },
    }),
  }));
  app.post("/sellers/:sellerId/follow", auth, async (r, reply) => {
    const { sellerId } = p.parse(r.params),
      uid = userId(r);
    if (uid === sellerId)
      throw new AppError(400, "SELF_FOLLOW", "You cannot follow yourself");
    if (!(await db().sellerProfile.findUnique({ where: { userId: sellerId } })))
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    if (
      await db().follow.findUnique({
        where: { followerId_sellerId: { followerId: uid, sellerId } },
      })
    )
      throw new AppError(
        409,
        "ALREADY_FOLLOWING",
        "Seller is already followed",
      );
    return reply
      .code(201)
      .send({
        data: await db().follow.create({ data: { followerId: uid, sellerId } }),
      });
  });
  app.delete("/sellers/:sellerId/follow", auth, async (r, reply) => {
    const { sellerId } = p.parse(r.params);
    const x = await db().follow.deleteMany({
      where: { followerId: userId(r), sellerId },
    });
    if (!x.count)
      throw new AppError(404, "FOLLOW_NOT_FOUND", "Follow not found");
    return reply.code(204).send();
  });
  app.get("/sellers/:sellerId/followers/count", async (r) => {
    const { sellerId } = p.parse(r.params);
    return {
      data: { count: await db().follow.count({ where: { sellerId } }) },
    };
  });
}
