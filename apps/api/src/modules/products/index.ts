import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const params = z.object({ id: z.string().min(1) });
const productBody = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.coerce.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1),
  images: z
    .array(
      z.object({
        url: z.url(),
        altText: z.string().max(300).optional(),
        position: z.number().int().min(0).optional(),
      }),
    )
    .max(12)
    .optional(),
});
const querySchema = z.object({
  category: z.string().optional(),
  seller: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const include = {
  images: { orderBy: { position: "asc" as const } },
  category: true,
  seller: { include: { user: { select: { id: true, name: true } } } },
};
const serialize = <T extends { price: { toString(): string } }>(
  product: T,
) => ({ ...product, price: money(product.price) });

export function registerProducts(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);
  app.get("/products", async (request) => {
    const q = querySchema.parse(request.query);
    if (
      q.minPrice !== undefined &&
      q.maxPrice !== undefined &&
      q.minPrice > q.maxPrice
    )
      throw new AppError(
        400,
        "INVALID_PRICE_RANGE",
        "Minimum price cannot exceed maximum price",
      );
    const where: Prisma.ProductWhereInput = {
      active: true,
      category: q.category
        ? { OR: [{ id: q.category }, { slug: q.category }] }
        : undefined,
      sellerId: q.seller,
      name: q.search ? { contains: q.search, mode: "insensitive" } : undefined,
      price: { gte: q.minPrice, lte: q.maxPrice },
    };
    const orderBy =
      q.sort === "price_asc"
        ? { price: "asc" as const }
        : q.sort === "price_desc"
          ? { price: "desc" as const }
          : { createdAt: "desc" as const };
    const [rows, total] = await db().$transaction([
      db().product.findMany({
        where,
        include,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      db().product.count({ where }),
    ]);
    return {
      data: rows.map(serialize),
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.ceil(total / q.limit),
      },
    };
  });
  app.get("/products/:id", async (request) => {
    const { id } = params.parse(request.params);
    const row = await db().product.findFirst({
      where: { id, active: true },
      include,
    });
    if (!row) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    return { data: serialize(row) };
  });
  app.post("/products", protectedRoute(app), async (request, reply) => {
    const input = productBody.parse(request.body);
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(request) },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile first",
      );
    const row = await db().product.create({
      data: {
        name: input.name,
        description: input.description,
        price: new Prisma.Decimal(input.price),
        stock: input.stock,
        categoryId: input.categoryId,
        sellerId: seller.id,
        images: input.images ? { create: input.images } : undefined,
      },
      include,
    });
    return reply.code(201).send({ data: serialize(row) });
  });
  app.patch("/products/:id", protectedRoute(app), async (request) => {
    const { id } = params.parse(request.params);
    const input = productBody.partial().parse(request.body);
    const owner = await db().product.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!owner)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    if (owner.seller.userId !== userId(request))
      throw new AppError(403, "FORBIDDEN", "You do not own this product");
    const { images, price, ...data } = input;
    const row = await db().product.update({
      where: { id },
      data: {
        ...data,
        price: price === undefined ? undefined : new Prisma.Decimal(price),
        images: images ? { deleteMany: {}, create: images } : undefined,
      },
      include,
    });
    return { data: serialize(row) };
  });
  app.delete("/products/:id", protectedRoute(app), async (request, reply) => {
    const { id } = params.parse(request.params);
    const owner = await db().product.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!owner)
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    if (owner.seller.userId !== userId(request))
      throw new AppError(403, "FORBIDDEN", "You do not own this product");
    await db().product.update({ where: { id }, data: { active: false } });
    return reply.code(204).send();
  });
}
