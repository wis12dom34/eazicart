import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const feedQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  source: z.enum(["EAZICART", "YOUTUBE", "TIKTOK", "PARTNER"]).optional(),
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

function serializeReel<T extends { product: null | { price: { toString(): string } } }>(
  reel: T,
) {
  return {
    ...reel,
    product: reel.product
      ? { ...reel.product, price: money(reel.product.price) }
      : null,
  };
}

export function registerReels(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);

  app.get("/reels/feed", async (request) => {
    const query = feedQuery.parse(request.query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.ReelWhereInput = {
      status: "PUBLISHED",
      source: query.source,
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

  app.post("/reels", protectedRoute(app), async (request, reply) => {
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
}
