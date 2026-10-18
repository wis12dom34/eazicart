import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const feedQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  source: z.enum(["EAZICART", "YOUTUBE", "TIKTOK", "PARTNER"]).optional(),
  productId: z.string().min(1).optional(),
  reelId: z.string().min(1).optional(),
  sellerId: z.string().min(1).optional(),
});

const commentsQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const createBody = z
  .object({
    idempotencyKey: z.uuid().optional(),
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
type CommentCursor = { createdAt: string; id: string };

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null)
      throw new Error("invalid cursor");

    const { id, publishedAt } = parsed as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      typeof publishedAt !== "string" ||
      Number.isNaN(new Date(publishedAt).getTime())
    )
      throw new Error("invalid cursor");

    return { id, publishedAt };
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The reels cursor is invalid");
  }
}

function encodeCommentCursor(cursor: CommentCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCommentCursor(value: string): CommentCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null)
      throw new Error("invalid cursor");

    const { id, createdAt } = parsed as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      typeof createdAt !== "string" ||
      Number.isNaN(new Date(createdAt).getTime())
    )
      throw new Error("invalid cursor");

    return { id, createdAt };
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The comments cursor is invalid");
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
      where: {
        id: reelId,
        status: "PUBLISHED",
        OR: [{ productId: null }, { product: { active: true } }],
      },
      select: { id: true },
    });
    if (!reel) throw new AppError(404, "REEL_NOT_FOUND", "Reel not found");
    return reel;
  };

  app.get("/reels/feed", async (request) => {
    const query = feedQuery.parse(request.query);
    if (request.headers.authorization) await app.authenticate(request);
    const uid = request.userId;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.ReelWhereInput = {
      status: "PUBLISHED",
      AND: [{ OR: [{ productId: null }, { product: { active: true } }] }],
      source: query.source,
      productId: query.productId,
      id: query.reelId,
      sellerId: query.sellerId,
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
    const chronologicalRows = hasMore ? rows.slice(0, query.limit) : rows;
    const cursorLast = chronologicalRows.at(-1);
    let rankedRows = chronologicalRows;
    if (uid && !cursor && !query.reelId && !query.productId && !query.sellerId) {
      const [likes, saves, views, follows, productBehavior, purchases] = await Promise.all([
        db().reelLike.findMany({ where: { userId: uid, createdAt: { gte: new Date(Date.now() - 90 * 86400000) } }, select: { reelId: true, createdAt: true, reel: { select: { sellerId: true, product: { select: { categoryId: true } } } } }, orderBy: { createdAt: "desc" }, take: 300 }),
        db().reelSave.findMany({ where: { userId: uid, createdAt: { gte: new Date(Date.now() - 180 * 86400000) } }, select: { reelId: true, createdAt: true, reel: { select: { sellerId: true, product: { select: { categoryId: true } } } } }, orderBy: { createdAt: "desc" }, take: 300 }),
        db().reelView.findMany({ where: { userId: uid, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { reelId: true, watchMs: true, completed: true, createdAt: true, reel: { select: { sellerId: true, product: { select: { categoryId: true } } } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
        db().follow.findMany({ where: { followerId: uid }, select: { sellerId: true } }),
        db().productFeedEvent.findMany({ where: { userId: uid, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { kind: true, dwellMs: true, createdAt: true, product: { select: { categoryId: true, sellerId: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
        db().orderItem.findMany({ where: { order: { userId: uid, status: { in: ["CONFIRMED", "FULFILLED"] }, payment: { status: "SUCCESS" }, createdAt: { gte: new Date(Date.now() - 180 * 86400000) } } }, select: { product: { select: { categoryId: true, sellerId: true } } }, take: 300 }),
      ]);
      const categoryAffinity = new Map<string, number>();
      const sellerAffinity = new Map<string, number>();
      const seen = new Set<string>();
      const addAffinity = (sellerId: string | null, categoryId: string | undefined, weight: number) => {
        if (sellerId) sellerAffinity.set(sellerId, (sellerAffinity.get(sellerId) ?? 0) + weight);
        if (categoryId) categoryAffinity.set(categoryId, (categoryAffinity.get(categoryId) ?? 0) + weight);
      };
      const decay = (createdAt: Date, halfLifeDays: number) => {
        const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / 86400000);
        return Math.exp(-Math.LN2 * ageDays / halfLifeDays);
      };
      for (const x of likes) {
        seen.add(x.reelId);
        addAffinity(x.reel.sellerId, x.reel.product?.categoryId, 2 * decay(x.createdAt, 14));
      }
      for (const x of saves) {
        seen.add(x.reelId);
        addAffinity(x.reel.sellerId, x.reel.product?.categoryId, 3 * decay(x.createdAt, 30));
      }
      for (const x of views) {
        seen.add(x.reelId);
        const base = x.completed ? 4 : Math.min(3, x.watchMs / 10000);
        const weight = base * decay(x.createdAt, 7);
        if (weight >= 0.25) addAffinity(x.reel.sellerId, x.reel.product?.categoryId, weight);
      }
      for (const x of productBehavior) {
        const base = x.kind === "NOT_INTERESTED" ? -2 : x.kind === "ADD_TO_CART" ? 5 : x.kind === "SHARE" ? 3 : x.kind === "OPEN" ? 1.5 : x.kind === "DWELL" ? Math.min(3, x.dwellMs / 10000) : 0.25;
        const ageDays = Math.max(0, (Date.now() - x.createdAt.getTime()) / 86400000);
        const weight = base * Math.exp(-Math.LN2 * ageDays / (x.kind === "NOT_INTERESTED" ? 21 : 7));
        addAffinity(x.product.sellerId, x.product.categoryId, weight);
      }
      for (const x of purchases) addAffinity(x.product.sellerId, x.product.categoryId, 8);
      const followed = new Set(follows.map((x) => x.sellerId));
      const now = Date.now();
      rankedRows = [...chronologicalRows].sort((a, b) => {
        const score = (r: typeof a) => {
          const ageHours = Math.max(0, (now - r.publishedAt.getTime()) / 3600000);
          const freshness = 10 * Math.exp(-ageHours / 168);
          const engagement = r._count.likes * 2 + r._count.saves * 3 + r._count.comments * 2 + Math.min(8, Math.log1p(r._count.views));
          const category = r.product?.categoryId ? (categoryAffinity.get(r.product.categoryId) ?? 0) * 2 : 0;
          const seller = r.sellerId ? (sellerAffinity.get(r.sellerId) ?? 0) * 1.5 + (r.seller?.userId && followed.has(r.seller.userId) ? 12 : 0) : 0;
          return freshness + engagement + category + seller + (seen.has(r.id) ? -5 : 3);
        };
        return score(b) - score(a) || b.publishedAt.getTime() - a.publishedAt.getTime();
      });
    }

    return {
      data: rankedRows.map(serializeReel),
      pagination: {
        nextCursor:
          hasMore && cursorLast
            ? encodeCursor({
                publishedAt: cursorLast.publishedAt.toISOString(),
                id: cursorLast.id,
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

    // A lost response must not turn a retry into another public Reel.
    const previousPublication = async () => {
      if (!input.idempotencyKey) return null;
      const previous = await db().reel.findUnique({
        where: { id: input.idempotencyKey },
        include,
      });
      if (
        previous &&
        (previous.sellerId !== seller.id ||
          previous.videoUrl !== input.videoUrl ||
          previous.status !== "PUBLISHED")
      )
        throw new AppError(
          409,
          "PUBLISH_CONFLICT",
          "This publication key is already in use",
        );
      return previous;
    };
    const previous = await previousPublication();
    if (previous)
      return reply.code(200).send({ data: serializeReel(previous) });

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

    try {
      const reel = await db().reel.create({
        data: {
          ...(input.idempotencyKey ? { id: input.idempotencyKey } : {}),
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
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await previousPublication();
        if (winner)
          return reply.code(200).send({ data: serializeReel(winner) });
      }
      throw error;
    }
  });

  app.get("/reels/:reelId/interactions", auth, async (request) => {
    const { reelId } = reelParams.parse(request.params);
    await requirePublishedReel(reelId);
    const uid = userId(request);
    const [like, save] = await Promise.all([
      db().reelLike.findUnique({
        where: { userId_reelId: { userId: uid, reelId } },
        select: { userId: true },
      }),
      db().reelSave.findUnique({
        where: { userId_reelId: { userId: uid, reelId } },
        select: { userId: true },
      }),
    ]);
    return { data: { liked: Boolean(like), saved: Boolean(save) } };
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
    const query = commentsQuery.parse(request.query);
    const cursor = query.cursor ? decodeCommentCursor(query.cursor) : null;
    await requirePublishedReel(reelId);

    const rows = await db().reelComment.findMany({
      where: {
        reelId,
        OR: cursor
          ? [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { lt: cursor.id },
              },
            ]
          : undefined,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);

    return {
      data: [...page].reverse(),
      pagination: {
        nextCursor:
          hasMore && last
            ? encodeCommentCursor({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              })
            : null,
        hasMore,
      },
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

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]