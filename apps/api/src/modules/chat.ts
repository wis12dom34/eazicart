import type { FastifyInstance } from "fastify";
import { Prisma, type PrismaClient } from "@eazicart/database";
import { z } from "zod";
import { AppError } from "../errors.js";
import { protectedRoute, requireDatabase, userId } from "./shared.js";

const conversationParams = z.object({ id: z.string().min(1).max(100) });
const pagination = z.object({
  cursor: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const include = {
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, userId: true, displayName: true } },
};
const messageFields = {
  id: true,
  body: true,
  senderId: true,
  conversationId: true,
  createdAt: true,
  readAt: true,
} as const;
export function registerChat(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app);
  const accessible = async (id: string, uid: string) => {
    const row = await db().chatConversation.findFirst({
      where: { id, OR: [{ buyerId: uid }, { seller: { userId: uid } }] },
      include,
    });
    if (!row)
      throw new AppError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation not found",
      );
    return row;
  };
  app.addHook("onSend", (r, reply, _payload, done) => {
    if (r.url.startsWith("/chat/"))
      reply.header("Cache-Control", "private, no-store");
    done();
  });
  app.post("/chat/conversations", auth, async (r, reply) => {
    const { sellerId } = z
        .object({ sellerId: z.string().min(1).max(100) })
        .parse(r.body),
      uid = userId(r);
    const seller = await db().sellerProfile.findFirst({
      where: { OR: [{ id: sellerId }, { userId: sellerId }] },
      select: { id: true, userId: true },
    });
    if (!seller)
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    if (seller.userId === uid)
      throw new AppError(
        400,
        "SELF_CHAT",
        "Open your inbox to reply to customers",
      );
    const where = { buyerId_sellerId: { buyerId: uid, sellerId: seller.id } };
    let data;
    try {
      data = await db().chatConversation.upsert({
        where,
        create: { buyerId: uid, sellerId: seller.id },
        update: {},
        include,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      data = await db().chatConversation.findUniqueOrThrow({ where, include });
    }
    return reply.code(201).send({ data });
  });
  app.get("/chat/conversations", auth, async (r) => {
    const q = pagination.parse(r.query),
      uid = userId(r);
    if (q.cursor) await accessible(q.cursor, uid);
    const rows = await db().chatConversation.findMany({
      where: { OR: [{ buyerId: uid }, { seller: { userId: uid } }] },
      include: {
        ...include,
        messages: {
          select: messageFields,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const data = rows.slice(0, q.limit),
      hasMore = rows.length > q.limit;
    const counts = await db().chatMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: data.map((c) => c.id) },
        senderId: { not: uid },
        readAt: null,
      },
      _count: { _all: true },
    });
    return {
      data: data.map(({ messages, ...c }) => ({
        ...c,
        lastMessage: messages[0] ?? null,
        unreadCount:
          counts.find((count) => count.conversationId === c.id)?._count._all ??
          0,
      })),
      pagination: {
        hasMore,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      },
    };
  });
  app.get("/chat/conversations/:id", auth, async (r) => {
    const { id } = conversationParams.parse(r.params);
    return { data: await accessible(id, userId(r)) };
  });
  app.get("/chat/conversations/:id/messages", auth, async (r) => {
    const { id } = conversationParams.parse(r.params);
    await accessible(id, userId(r));
    const q = pagination.parse(r.query);
    const cursor = q.cursor
      ? await db().chatMessage.findFirst({
          where: { id: q.cursor, conversationId: id },
          select: { id: true, createdAt: true },
        })
      : null;
    if (q.cursor && !cursor)
      throw new AppError(400, "INVALID_CURSOR", "Invalid messages cursor");
    const rows = await db().chatMessage.findMany({
      where: {
        conversationId: id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: messageFields,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit),
      hasMore = rows.length > q.limit;
    return {
      data: page.reverse(),
      pagination: {
        hasMore,
        nextCursor: hasMore ? (page[0]?.id ?? null) : null,
      },
    };
  });
  app.post("/chat/conversations/:id/messages", auth, async (r, reply) => {
    const { id } = conversationParams.parse(r.params),
      uid = userId(r);
    await accessible(id, uid);
    const input = z
      .object({
        body: z.string().trim().min(1).max(2000),
        idempotencyKey: z.uuid(),
      })
      .parse(r.body);
    const previous = await db().chatMessage.findUnique({
      where: { id: input.idempotencyKey },
      select: messageFields,
    });
    if (previous) {
      if (
        previous.senderId !== uid ||
        previous.conversationId !== id ||
        previous.body !== input.body
      )
        throw new AppError(
          409,
          "MESSAGE_CONFLICT",
          "Please try sending this message again",
        );
      return { data: previous };
    }
    const recent = await db().chatMessage.count({
      where: { senderId: uid, createdAt: { gt: new Date(Date.now() - 60000) } },
    });
    if (recent >= 30)
      throw new AppError(
        429,
        "MESSAGE_LIMIT",
        "Please wait a minute before sending more messages",
      );
    const data = await db().$transaction(async (tx) => {
      const message = await tx.chatMessage.upsert({
        where: { id: input.idempotencyKey },
        create: {
          id: input.idempotencyKey,
          body: input.body,
          conversationId: id,
          senderId: uid,
        },
        update: {},
        select: messageFields,
      });
      if (
        message.senderId !== uid ||
        message.conversationId !== id ||
        message.body !== input.body
      )
        throw new AppError(
          409,
          "MESSAGE_CONFLICT",
          "Please try sending this message again",
        );
      await tx.chatConversation.updateMany({
        where: {
          id,
          OR: [
            { lastMessageAt: null },
            { lastMessageAt: { lt: message.createdAt } },
          ],
        },
        data: { lastMessageAt: message.createdAt },
      });
      return message;
    });
    return reply.code(201).send({ data });
  });
  app.post("/chat/conversations/:id/read", auth, async (r) => {
    const { id } = conversationParams.parse(r.params),
      uid = userId(r);
    await accessible(id, uid);
    const { messageIds } = z
      .object({
        messageIds: z.array(z.string().min(1).max(100)).min(1).max(100),
      })
      .parse(r.body);
    // Only received messages actually shown by the client are marked read.
    const result = await db().chatMessage.updateMany({
      where: {
        id: { in: messageIds },
        conversationId: id,
        senderId: { not: uid },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { data: { updated: result.count } };
  });
}