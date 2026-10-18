import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const params = z.object({ id: z.string().min(1) });
const publicImageUrl = z.url().refine((value) => /^https?:\/\//i.test(value), {
  message: "Product image URLs must use http or https",
});
const productBody = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.coerce.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1),
  images: z
    .array(
      z.object({
        url: publicImageUrl,
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

const feedInclude = {
  images: { orderBy: { position: "asc" as const }, take: 1 },
  category: true,
  seller: { include: { user: { select: { id: true, name: true } } } },
  _count: {
    select: {
      images: true,
      likes: true,
      comments: true,
      savedBy: true,
      orderItems: {
        where: {
          order: {
            status: { in: ["CONFIRMED", "FULFILLED"] },
            payment: { status: "SUCCESS" },
          },
        },
      },
    },
  },
  reels: {
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      _count: {
        select: { likes: true, saves: true, views: true, comments: true },
      },
    },
    take: 3,
  },
} satisfies Prisma.ProductInclude;

type ProductFeedCursor = { ids: string[] };

function encodeProductFeedCursor(ids: string[]) {
  return Buffer.from(
    JSON.stringify({ ids } satisfies ProductFeedCursor),
    "utf8",
  ).toString("base64url");
}

function decodeProductFeedCursor(value: string): ProductFeedCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("ids" in parsed) ||
      !Array.isArray(parsed.ids)
    ) {
      throw new Error("invalid cursor");
    }
    const ids: unknown[] = parsed.ids;
    if (
      ids.length > 300 ||
      ids.some((id) => typeof id !== "string" || id.length === 0) ||
      new Set(ids).size !== ids.length
    ) {
      throw new Error("invalid cursor");
    }
    return { ids: ids as string[] };
  } catch {
    throw new AppError(
      400,
      "INVALID_CURSOR",
      "The product feed cursor is invalid",
    );
  }
}

export function registerProducts(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);
  app.post(
    "/feed/products/:id/event",
    protectedRoute(app),
    async (request, reply) => {
      const { id } = params.parse(request.params);
      const input = z
        .object({
          kind: z.enum(["VIEW", "OPEN", "DWELL", "SHARE", "NOT_INTERESTED"]),
          dwellMs: z.number().int().min(0).max(300000).default(0),
        })
        .parse(request.body);
      const product = await db().product.findFirst({
        where: { id, active: true },
        select: { id: true },
      });
      if (!product)
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
      const uid = userId(request);
      if (input.kind === "DWELL" && input.dwellMs < 2000)
        return reply.code(204).send();
      if (input.kind === "VIEW" || input.kind === "OPEN") {
        const cooldownMs =
          input.kind === "VIEW" ? 30 * 60 * 1000 : 20 * 60 * 1000;
        const recentEvent = await db().productFeedEvent.findFirst({
          where: {
            userId: uid,
            productId: id,
            kind: input.kind,
            createdAt: { gte: new Date(Date.now() - cooldownMs) },
          },
          select: { id: true },
        });
        if (recentEvent) return reply.code(204).send();
      }
      await db().productFeedEvent.create({
        data: {
          userId: uid,
          productId: id,
          kind: input.kind,
          dwellMs: input.kind === "DWELL" ? input.dwellMs : 0,
        },
      });
      return reply.code(204).send();
    },
  );
  app.get("/feed/products", async (request, reply) => {
    const q = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        cursor: z.string().min(1).optional(),
      })
      .parse(request.query);
    if (request.headers.authorization) await app.authenticate(request);
    const uid = request.userId;
    const cursor = q.cursor ? decodeProductFeedCursor(q.cursor) : null;

    // The first response ranks a bounded candidate pool and freezes its ordered
    // IDs into the cursor. Later pages follow that snapshot instead of re-ranking
    // products between requests and accidentally repeating/skipping items.
    if (cursor) {
      const rows = cursor.ids.length
        ? await db().product.findMany({
            where: { id: { in: cursor.ids }, active: true, stock: { gt: 0 } },
            include: feedInclude,
          })
        : [];
      const byId = new Map(rows.map((product) => [product.id, product]));
      const page: typeof rows = [];
      let consumed = 0;
      while (consumed < cursor.ids.length && page.length < q.limit) {
        const id = cursor.ids[consumed];
        consumed += 1;
        if (!id) continue;
        const product = byId.get(id);
        if (product) page.push(product);
      }
      const likedIds = uid
        ? new Set(
            (
              await db().productLike.findMany({
                where: {
                  userId: uid,
                  productId: { in: page.map((p) => p.id) },
                },
                select: { productId: true },
              })
            ).map((item) => item.productId),
          )
        : new Set<string>();
      const remainingIds = cursor.ids.slice(consumed);
      reply.header(
        "Cache-Control",
        uid ? "private, no-store" : "public, max-age=20",
      );
      return {
        data: page.map((product) => {
          const serialized = serialize(product);
          return {
            ...serialized,
            imageCount: product._count.images,
            images: serialized.images.slice(0, 1),
            _count: undefined,
            reels: undefined,
            social: {
              likes: product._count.likes,
              comments: product._count.comments,
              liked: likedIds.has(product.id),
            },
          };
        }),
        pagination: {
          nextCursor: remainingIds.length
            ? encodeProductFeedCursor(remainingIds)
            : null,
          hasMore: remainingIds.length > 0,
        },
      };
    }

    const rows = await db().product.findMany({
      where: { active: true, stock: { gt: 0 } },
      include: feedInclude,
      orderBy: { createdAt: "desc" },
      take: Math.min(300, Math.max(q.limit * 4, 80)),
    });
    const [following, liked, saved, bought] = uid
      ? await Promise.all([
          db().follow.findMany({
            where: { followerId: uid },
            select: { sellerId: true },
          }),
          db().productLike.findMany({
            where: { userId: uid },
            select: {
              productId: true,
              product: { select: { categoryId: true } },
            },
          }),
          db().savedProduct.findMany({
            where: { userId: uid },
            select: {
              productId: true,
              product: { select: { categoryId: true } },
            },
          }),
          db().orderItem.findMany({
            where: {
              order: {
                userId: uid,
                status: { in: ["CONFIRMED", "FULFILLED"] },
                payment: { status: "SUCCESS" },
              },
            },
            select: {
              productId: true,
              product: { select: { categoryId: true } },
            },
            take: 200,
          }),
        ])
      : [[], [], [], []];
    const categoryAffinity = new Map<string, number>();
    const behavior = uid
      ? await db().productFeedEvent.findMany({
          where: {
            userId: uid,
            createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
          },
          select: {
            productId: true,
            kind: true,
            dwellMs: true,
            createdAt: true,
            product: { select: { categoryId: true } },
          },
          take: 1000,
          orderBy: { createdAt: "desc" },
        })
      : [];
    const productBehavior = new Map<string, number>();
    const behaviorNow = Date.now();
    for (const event of behavior) {
      const baseWeight =
        event.kind === "NOT_INTERESTED"
          ? -60
          : event.kind === "ADD_TO_CART"
            ? 10
            : event.kind === "SHARE"
              ? 7
              : event.kind === "OPEN"
                ? 3
                : event.kind === "DWELL"
                  ? Math.min(6, event.dwellMs / 5000)
                  : 0.5;
      const ageDays = Math.max(
        0,
        (behaviorNow - event.createdAt.getTime()) / 86400000,
      );
      // Recent intent should shape the feed most. Positive interest halves about every 7 days;
      // explicit negative feedback fades more slowly so hidden content does not bounce back quickly.
      const halfLifeDays = event.kind === "NOT_INTERESTED" ? 21 : 7;
      const weight =
        baseWeight * Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
      productBehavior.set(
        event.productId,
        (productBehavior.get(event.productId) ?? 0) + weight,
      );
      if (weight > 0)
        categoryAffinity.set(
          event.product.categoryId,
          (categoryAffinity.get(event.product.categoryId) ?? 0) +
            Math.min(3, weight * 0.35),
        );
    }
    const followed = new Set(following.map((x) => x.sellerId));
    const seenProducts = new Set(
      [...liked, ...saved, ...bought].map((x) => x.productId),
    );
    for (const x of liked)
      categoryAffinity.set(
        x.product.categoryId,
        (categoryAffinity.get(x.product.categoryId) ?? 0) + 2,
      );
    for (const x of saved)
      categoryAffinity.set(
        x.product.categoryId,
        (categoryAffinity.get(x.product.categoryId) ?? 0) + 3,
      );
    for (const x of bought)
      categoryAffinity.set(
        x.product.categoryId,
        (categoryAffinity.get(x.product.categoryId) ?? 0) + 5,
      );
    const now = Date.now();
    const ranked = rows
      .map((product) => {
        const ageHours = Math.max(
          0,
          (now - product.createdAt.getTime()) / 3_600_000,
        );
        const freshness = 12 * Math.exp(-ageHours / 168);
        const reelSignal = product.reels.reduce(
          (sum, reel) =>
            sum +
            reel._count.likes * 2 +
            reel._count.saves * 3 +
            reel._count.comments * 2 +
            Math.min(8, Math.log1p(reel._count.views)),
          0,
        );
        const engagement =
          product._count.likes * 2 +
          product._count.comments * 2.5 +
          product._count.savedBy * 3.5 +
          product._count.orderItems * 6 +
          reelSignal;
        const personal =
          (followed.has(product.seller.userId) ? 18 : 0) +
          (categoryAffinity.get(product.categoryId) ?? 0) * 2.5;
        const discovery = seenProducts.has(product.id) ? -4 : 3;
        const learned = productBehavior.get(product.id) ?? 0;
        return {
          product,
          score: freshness + engagement + personal + discovery + learned,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.product.createdAt.getTime() - a.product.createdAt.getTime(),
      );
    const selected: typeof ranked = [];
    const sellerCount = new Map<string, number>();
    const categoryCount = new Map<string, number>();
    const knownCategories = new Set(categoryAffinity.keys());
    const addSelected = (item: (typeof ranked)[number]) => {
      selected.push(item);
      sellerCount.set(
        item.product.sellerId,
        (sellerCount.get(item.product.sellerId) ?? 0) + 1,
      );
      categoryCount.set(
        item.product.categoryId,
        (categoryCount.get(item.product.categoryId) ?? 0) + 1,
      );
    };
    for (const item of ranked) {
      if (selected.length >= q.limit) break;
      const sellerHits = sellerCount.get(item.product.sellerId) ?? 0;
      const categoryHits = categoryCount.get(item.product.categoryId) ?? 0;
      if (sellerHits >= 2 && selected.length < Math.min(q.limit, 20)) continue;
      if (
        categoryHits >= Math.max(3, Math.ceil(q.limit * 0.35)) &&
        selected.length < Math.min(q.limit, 20)
      )
        continue;
      addSelected(item);
      // About every sixth slot, deliberately explore a strong unseen category/seller.
      // This is deterministic: no fake/random ranking, and only real active inventory is eligible.
      if (uid && selected.length < q.limit && selected.length % 6 === 5) {
        const explorer = ranked.find(
          (candidate) =>
            !selected.includes(candidate) &&
            !seenProducts.has(candidate.product.id) &&
            (!knownCategories.has(candidate.product.categoryId) ||
              !followed.has(candidate.product.seller.userId)) &&
            (sellerCount.get(candidate.product.sellerId) ?? 0) === 0,
        );
        if (explorer) addSelected(explorer);
      }
    }
    for (const item of ranked) {
      if (!selected.includes(item)) selected.push(item);
    }
    const orderedProducts = selected.map(({ product }) => product);
    const selectedProducts = orderedProducts.slice(0, q.limit);
    const nextCursorIds = orderedProducts
      .slice(q.limit)
      .map((product) => product.id);
    const likedIds = uid
      ? new Set(liked.map((item) => item.productId))
      : new Set<string>();
    reply.header(
      "Cache-Control",
      uid ? "private, no-store" : "public, max-age=20",
    );
    return {
      data: selectedProducts.map((product) => {
        const serialized = serialize(product);
        return {
          ...serialized,
          imageCount: product._count.images,
          // Home/feed cards only render the cover image. Gallery images are loaded
          // from the product endpoint when the shopper opens the product.
          images: serialized.images.slice(0, 1),
          // Ranking-only aggregates/reels stay server-side instead of inflating
          // every feed response.
          _count: undefined,
          reels: undefined,
          social: {
            likes: product._count.likes,
            comments: product._count.comments,
            liked: likedIds.has(product.id),
          },
        };
      }),
      pagination: {
        nextCursor: nextCursorIds.length
          ? encodeProductFeedCursor(nextCursorIds)
          : null,
        hasMore: nextCursorIds.length > 0,
      },
    };
  });
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
  app.get("/seller/products", protectedRoute(app), async (request) => {
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
    const rows = await db().product.findMany({
      where: { sellerId: seller.id },
      include,
      orderBy: { createdAt: "desc" },
    });
    return { data: rows.map(serialize) };
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

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]