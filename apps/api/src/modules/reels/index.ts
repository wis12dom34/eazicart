import type { Prisma, PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const feedQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  source: z.enum(["EAZICART", "YOUTUBE", "TIKTOK", "PARTNER"]).optional(),
  productId: z.string().min(1).optional(),
});

const createBody = z
  .object({
    caption: z.string().trim().max(2200).nullable().optional(),
    videoUrl: z.url().optional(),
    thumbnailUrl: z.url().optional(),
    productId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.videoUrl), {
    message: "A video URL is required",
    path: ["videoUrl"],
  });

const reelParams = z.object({ reelId: z.string().min(1) });
const commentBody = z.object({ body: z.string().trim().min(1).max(1000) });
const viewBody = z.object({
  watchMs: z.coerce.number().int().min(0).max(86_400_000).default(0),
  completed: z.boolean().default(false),
});

const include = {
  seller: {
    include: { user: { select: { id: true, name: true } } },
  },
  product: {
    include: {
      images: { orderBy: { position: "asc" as const } },
      category: true,
      seller: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  },
  _count: {
    select: { likes: true, saves: true, views: true, comments: true },
  },
};

type Cursor = { publishedAt: string; id: string };

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Cursor;
    if (!parsed.id || Number.isNaN(new Date(parsed.publishedAt).getTime()))
      throw new Error("invalid cursor");
    return parsed;
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The reels cursor is invalid");
  }
}

function serializeReel<
  T extends { product: null | { price: { toString(): string } } },
>(reel: T) {
  return {
    ...reel,
    product: reel.product
      ? { ...reel.product, price: money(reel.product.price) }
      : null,
  };
}

export function registerReels(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);

  const requirePublishedReel = async (reelId: string) => {
    const reel = await db().reel.findFirst({
      where: { id: reelId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!reel) throw new AppError(404, "REEL_NOT_FOUND", "Reel not found");
    return reel;
  };

  app.get("/reels/feed", async (request) => {
    const query = feedQuery.parse(request.query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.ReelWhereInput = {
      status: "PUBLISHED",
      source: query.source,
      productId: query.productId,
      OR: cursor
        ? [
            { publishedAt: { lt: new Date(cursor.publishedAt) } },
            {
              publishedAt: new Date(cursor.publishedAt),
              id: { lt: cursor.id },
            },
          ]
        : undefined,
    };

    const rows = await db().reel.findMany({
      where,
      include,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);

    return {
      data: items.map(serializeReel),
      pagination: {
        nextCursor:
          hasMore && last
            ? encodeCursor({
                publishedAt: last.publishedAt.toISOString(),
                id: last.id,
              })
            : null,
        hasMore,
      },
    };
  });

  app.post("/reels", auth, async (request, reply) => {
    const input = createBody.parse(request.body);
    const seller = await db().sellerProfile.findUnique({
      where: { userId: userId(request) },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(
        403,
        "SELLER_REQUIRED",
        "Create a seller profile before publishing reels",
      );

    if (input.productId) {
      const product = await db().product.findFirst({
        where: { id: input.productId, sellerId: seller.id, active: true },
        select: { id: true },
      });
      if (!product)
        throw new AppError(
          404,
          "PRODUCT_NOT_FOUND",
          "Choose one of your active products",
        );
    }

    const reel = await db().reel.create({
      data: {
        source: "EAZICART",
        status: "PUBLISHED",
        caption: input.caption,
        videoUrl: input.videoUrl,
        thumbnailUrl: input.thumbnailUrl,
        sellerId: seller.id,
        productId: input.productId,
      },
      include,
    });

    return reply.code(201).send({ data: serializeReel(reel) });
  });

  app.post("/reels/:reelId/like", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    const uid = userId(request);
    await db().reelLike.upsert({
      where: { userId_reelId: { userId: uid, reelId } },
      update: {},
      create: { userId: uid, reelId },
    });
    const count = await db().reelLike.count({ where: { reelId } });
    return reply.code(201).send({ data: { liked: true, count } });
  });

  app.delete("/reels/:reelId/like", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    await db().reelLike.deleteMany({
      where: { userId: userId(request), reelId },
    });
    const count = await db().reelLike.count({ where: { reelId } });
    return reply.send({ data: { liked: false, count } });
  });

  app.post("/reels/:reelId/save", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    const uid = userId(request);
    await db().reelSave.upsert({
      where: { userId_reelId: { userId: uid, reelId } },
      update: {},
      create: { userId: uid, reelId },
    });
    const count = await db().reelSave.count({ where: { reelId } });
    return reply.code(201).send({ data: { saved: true, count } });
  });

  app.delete("/reels/:reelId/save", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    await db().reelSave.deleteMany({
      where: { userId: userId(request), reelId },
    });
    const count = await db().reelSave.count({ where: { reelId } });
    return reply.send({ data: { saved: false, count } });
  });

  app.get("/reels/:reelId/comments", async (request) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    return {
      data: await db().reelComment.findMany({
        where: { reelId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    };
  });

  app.post("/reels/:reelId/comments", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    const input = commentBody.parse(request.body);
    await requirePublishedReel(reelId);
    const data = await db().reelComment.create({
      data: { reelId, userId: userId(request), body: input.body },
      include: { user: { select: { id: true, name: true } } },
    });
    return reply.code(201).send({ data });
  });

  app.post("/reels/:reelId/views", auth, async (request, reply) => {
    const { reelId } = reelParams.parse(request.params);
    const input = viewBody.parse(request.body ?? {});
    await requirePublishedReel(reelId);
    const data = await db().reelView.create({
      data: {
        reelId,
        userId: userId(request),
        watchMs: input.watchMs,
        completed: input.completed,
      },
      select: { id: true, watchMs: true, completed: true, createdAt: true },
    });
    return reply.code(201).send({ data });
  });
}
