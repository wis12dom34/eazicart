import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { requireDatabase } from "../shared.js";

export function registerCategories(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  app.get("/categories", async () => ({
    data: await requireDatabase(client).category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
  }));
  app.get("/categories/:id", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = await requireDatabase(client).category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
    });
    if (!data)
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
    return { data };
  });
}
