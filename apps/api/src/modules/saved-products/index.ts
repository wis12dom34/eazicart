import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
export function registerSavedProducts(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app),
    p = z.object({ productId: z.string() });
  app.get("/saved-products", auth, async (r) => ({
    data: await db().savedProduct.findMany({
      where: { userId: userId(r) },
      orderBy: { createdAt: "desc" },
      include: {
        product: { include: { images: true, category: true, seller: true } },
      },
    }),
  }));
  app.post("/saved-products/:productId", auth, async (r, reply) => {
    const { productId } = p.parse(r.params),
      uid = userId(r);
    if (
      !(await db().product.findFirst({
        where: { id: productId, active: true },
      }))
    )
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    if (
      await db().savedProduct.findUnique({
        where: { userId_productId: { userId: uid, productId } },
      })
    )
      throw new AppError(409, "ALREADY_SAVED", "Product is already saved");
    const data = await db().savedProduct.create({
      data: { userId: uid, productId },
    });
    return reply.code(201).send({ data });
  });
  app.delete("/saved-products/:productId", auth, async (r, reply) => {
    const { productId } = p.parse(r.params);
    const x = await db().savedProduct.deleteMany({
      where: { userId: userId(r), productId },
    });
    if (!x.count)
      throw new AppError(
        404,
        "SAVED_PRODUCT_NOT_FOUND",
        "Saved product not found",
      );
    return reply.code(204).send();
  });
}
