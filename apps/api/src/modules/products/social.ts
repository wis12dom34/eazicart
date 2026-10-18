import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

const params = z.object({ id: z.string().min(1).max(100) });
const commentInput = z.object({
  body: z.string().trim().max(1000).default(""),
  mediaUrl: z.string().url().max(2000).optional(),
  mediaType: z.enum(["image", "gif"]).optional(),
  parentId: z.string().min(1).max(100).optional(),
  idempotencyKey: z.uuid().optional(),
});
const publicAuthor = { id: true, name: true } as const;

export function registerProductSocial(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);
  const requireProduct = async (id: string) => {
    if (
      !(await db().product.findFirst({
        where: { id, active: true },
        select: { id: true },
      }))
    )
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  };
  const summary = async (id: string, uid?: string) => {
    const [likes, comments, like] = await Promise.all([
      db().productLike.count({ where: { productId: id } }),
      db().productComment.count({ where: { productId: id } }),
      uid
        ? db().productLike.findUnique({
            where: { userId_productId: { userId: uid, productId: id } },
          })
        : Promise.resolve(null),
    ]);
    return { likes, comments, liked: Boolean(like) };
  };
  app.get("/products/:id/social", async (r, reply) => {
    const { id } = params.parse(r.params);
    if (r.headers.authorization) await app.authenticate(r);
    await requireProduct(id);
    reply.header("Cache-Control", "private, no-store");
    return { data: await summary(id, r.userId) };
  });
  app.post("/products/:id/like", auth, async (r, reply) => {
    const { id } = params.parse(r.params);
    await requireProduct(id);
    const uid = userId(r);
    await db().productLike.upsert({
      where: { userId_productId: { userId: uid, productId: id } },
      create: { userId: uid, productId: id },
      update: {},
    });
    return reply.code(201).send({ data: await summary(id, uid) });
  });
  app.delete("/products/:id/like", auth, async (r) => {
    const { id } = params.parse(r.params);
    await requireProduct(id);
    const uid = userId(r);
    await db().productLike.deleteMany({
      where: { userId: uid, productId: id },
    });
    return { data: await summary(id, uid) };
  });
  app.get("/products/:id/comments", async (r) => {
    const { id } = params.parse(r.params);
    if (r.headers.authorization) await app.authenticate(r);
    await requireProduct(id);
    const q = z
      .object({
        cursor: z.string().min(1).max(100).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(r.query);
    const cursor = q.cursor
      ? await db().productComment.findFirst({
          where: { id: q.cursor, productId: id },
        })
      : null;
    if (q.cursor && !cursor)
      throw new AppError(400, "INVALID_CURSOR", "Invalid comments cursor");
    const rows = await db().productComment.findMany({
      where: {
        productId: id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { user: { select: publicAuthor }, parent: { select: { id: true, user: { select: publicAuthor } } }, _count: { select: { likes: true, replies: true } }, ...(r.userId ? { likes: { where: { userId: r.userId }, select: { userId: true } } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit,
      data = rows.slice(0, q.limit).map((row) => ({ ...row, likeCount: row._count.likes, replyCount: row._count.replies, liked: "likes" in row ? Boolean(row.likes?.length) : false, _count: undefined, likes: undefined }));
    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      },
    };
  });
  app.post("/products/:id/comments", auth, async (r, reply) => {
    const { id } = params.parse(r.params);
    await requireProduct(id);
    const input = commentInput.parse(r.body),
      uid = userId(r);
    if (!input.body && !input.mediaUrl) throw new AppError(400, "EMPTY_COMMENT", "Add text, an image or a GIF");
    if (Boolean(input.mediaUrl) !== Boolean(input.mediaType)) throw new AppError(400, "INVALID_COMMENT_MEDIA", "Invalid comment media");
    if (input.parentId && !(await db().productComment.findFirst({ where: { id: input.parentId, productId: id }, select: { id: true } }))) throw new AppError(400, "INVALID_PARENT_COMMENT", "Reply target not found");
    // Client UUID makes retrying a lost response safe without duplicating comments.
    const key = input.idempotencyKey;
    const data = key
      ? await db().productComment.upsert({
          where: { id: key },
          create: { id: key, body: input.body, mediaUrl: input.mediaUrl, mediaType: input.mediaType, parentId: input.parentId, userId: uid, productId: id },
          update: {},
          include: { user: { select: publicAuthor } },
        })
      : await db().productComment.create({
          data: { body: input.body, mediaUrl: input.mediaUrl, mediaType: input.mediaType, parentId: input.parentId, userId: uid, productId: id },
          include: { user: { select: publicAuthor } },
        });
    if (
      data.userId !== uid ||
      data.productId !== id ||
      data.body !== input.body || data.mediaUrl !== (input.mediaUrl ?? null) || data.mediaType !== (input.mediaType ?? null) || data.parentId !== (input.parentId ?? null)
    )
      throw new AppError(
        409,
        "COMMENT_CONFLICT",
        "Please try submitting this comment again",
      );
    return reply.code(201).send({ data });
  });

  app.post("/products/:id/comments/:commentId/like", auth, async (r, reply) => {
    const { id, commentId } = params.extend({ commentId: z.string().min(1).max(100) }).parse(r.params);
    await requireProduct(id);
    const comment = await db().productComment.findFirst({ where: { id: commentId, productId: id }, select: { id: true } });
    if (!comment) throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    const uid = userId(r);
    await db().productCommentLike.upsert({ where: { userId_commentId: { userId: uid, commentId } }, create: { userId: uid, commentId }, update: {} });
    const likeCount = await db().productCommentLike.count({ where: { commentId } });
    return reply.code(201).send({ data: { liked: true, likeCount } });
  });
  app.delete("/products/:id/comments/:commentId/like", auth, async (r) => {
    const { id, commentId } = params.extend({ commentId: z.string().min(1).max(100) }).parse(r.params);
    await requireProduct(id);
    const comment = await db().productComment.findFirst({ where: { id: commentId, productId: id }, select: { id: true } });
    if (!comment) throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    await db().productCommentLike.deleteMany({ where: { userId: userId(r), commentId } });
    const likeCount = await db().productCommentLike.count({ where: { commentId } });
    return { data: { liked: false, likeCount } };
  });
  app.delete("/products/:id/comments/:commentId", auth, async (r, reply) => {
    const { id, commentId } = params
      .extend({ commentId: z.string().min(1).max(100) })
      .parse(r.params);
    await requireProduct(id);
    const row = await db().productComment.findFirst({
      where: { id: commentId, productId: id },
    });
    if (!row) throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    if (row.userId !== userId(r))
      throw new AppError(
        403,
        "FORBIDDEN",
        "You can only remove your own comments",
      );
    await db().productComment.deleteMany({
      where: { id: commentId, productId: id, userId: userId(r) },
    });
    return reply.code(204).send();
  });
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]