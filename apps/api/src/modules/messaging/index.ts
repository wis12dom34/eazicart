import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

const params = z.object({ id: z.string().min(1).max(128) });
const listQuery = z.object({ cursor: z.string().min(1).max(128).optional() });
const startBody = z.object({ sellerUserId: z.string().min(1).max(128) });
const messageBody = z
  .object({
    body: z.string().trim().max(4000).default(""),
    productId: z.string().min(1).max(128).optional(),
    clientMessageId: z.string().uuid(),
  })
  .refine((input) => Boolean(input.body || input.productId), {
    message: "Text or a product is required",
  });
const summarySelect = {
  id: true,
  buyerId: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
  buyerReadAt: true,
  sellerReadAt: true,
  buyerBlockedAt: true,
  sellerBlockedAt: true,
  buyer: { select: { id: true, name: true } },
  seller: {
    select: {
      id: true,
      name: true,
      sellerProfile: { select: { displayName: true } },
    },
  },
} as const;
const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  clientMessageId: true,
  createdAt: true,
  productId: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      active: true,
      images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
    },
  },
} as const;

export function registerMessaging(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);
  const permitted = async (id: string, uid: string) => {
    const conversation = await db().conversation.findFirst({
      where: { id, OR: [{ buyerId: uid }, { sellerId: uid }] },
      select: { id: true },
    });
    if (!conversation)
      throw new AppError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation not found",
      );
  };

  app.get("/conversations", auth, async (request) => {
    const uid = userId(request);
    const conversations = await db().conversation.findMany({
      where: { OR: [{ buyerId: uid }, { sellerId: uid }] },
      select: summarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    // One grouped query replaces one unread count query per conversation.
    const unreadFilters = conversations.map((conversation) => {
      const readAt =
        conversation.buyerId === uid
          ? conversation.buyerReadAt
          : conversation.sellerReadAt;
      return {
        conversationId: conversation.id,
        senderId: { not: uid },
        ...(readAt ? { createdAt: { gt: readAt } } : {}),
      };
    });
    const unreadGroups = unreadFilters.length
      ? await db().chatMessage.groupBy({
          by: ["conversationId"],
          where: { OR: unreadFilters },
          _count: { _all: true },
        })
      : [];
    const counts = new Map(
      unreadGroups.map((item) => [item.conversationId, item._count._all]),
    );
    const data = conversations.map((conversation) => ({
      ...conversation,
      unreadCount: counts.get(conversation.id) ?? 0,
    }));
    return {
      data,
      meta: { unreadCount: data.reduce((sum, c) => sum + c.unreadCount, 0) },
    };
  });

  app.post("/conversations", auth, async (request, reply) => {
    const buyerId = userId(request);
    const { sellerUserId: sellerId } = startBody.parse(request.body);
    if (buyerId === sellerId)
      throw new AppError(400, "SELF_CONVERSATION", "Cannot message yourself");
    const seller = await db().sellerProfile.findUnique({
      where: { userId: sellerId },
      select: { id: true },
    });
    if (!seller)
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    const where = { buyerId_sellerId: { buyerId, sellerId } };
    let conversation;
    try {
      conversation = await db().conversation.upsert({
        where,
        update: {},
        create: { buyerId, sellerId },
        select: summarySelect,
      });
    } catch (error) {
      // Concurrent initial requests can race on the buyer/seller unique key.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      conversation = await db().conversation.findUnique({
        where,
        select: summarySelect,
      });
      if (!conversation) throw error;
    }
    return reply.code(200).send({ data: conversation });
  });

  app.get("/conversations/:id/messages", auth, async (request) => {
    const { id } = params.parse(request.params);
    const { cursor } = listQuery.parse(request.query);
    await permitted(id, userId(request));
    if (cursor) {
      const anchor = await db().chatMessage.findFirst({
        where: { id: cursor, conversationId: id },
        select: { id: true },
      });
      if (!anchor)
        throw new AppError(400, "INVALID_CURSOR", "Invalid message cursor");
    }
    const items = await db().chatMessage.findMany({
      where: { conversationId: id },
      select: messageSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = items.length > 30;
    const data = items.slice(0, 30);
    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      },
    };
  });

  app.patch("/conversations/:id/read", auth, async (request) => {
    const { id } = params.parse(request.params);
    const uid = userId(request);
    await permitted(id, uid);
    // Only acknowledge messages already stored before the read request.
    // The timestamp is assigned server-side; readers never choose it.
    const latest = await db().chatMessage.findFirst({
      where: { conversationId: id, senderId: { not: uid } },
      select: { createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (latest) {
      const field =
        (
          await db().conversation.findUniqueOrThrow({
            where: { id },
            select: { buyerId: true },
          })
        ).buyerId === uid
          ? "buyerReadAt"
          : "sellerReadAt";
      await db().conversation.updateMany({
        where: {
          id,
          OR: [{ [field]: null }, { [field]: { lt: latest.createdAt } }],
        },
        data: { [field]: latest.createdAt },
      });
    }
    return { data: { read: true } };
  });

  app.patch("/conversations/:id/block", auth, async (request) => {
    const { id } = params.parse(request.params);
    const uid = userId(request);
    const { blocked } = z.object({ blocked: z.boolean() }).parse(request.body);
    const conversation = await db().conversation.findFirst({
      where: { id, OR: [{ buyerId: uid }, { sellerId: uid }] },
      select: { buyerId: true },
    });
    if (!conversation)
      throw new AppError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation not found",
      );
    const field =
      conversation.buyerId === uid ? "buyerBlockedAt" : "sellerBlockedAt";
    await db().conversation.update({
      where: { id },
      data: { [field]: blocked ? new Date() : null },
    });
    return { data: { blocked } };
  });

  app.post("/conversations/:id/messages", auth, async (request, reply) => {
    const { id } = params.parse(request.params);
    const uid = userId(request);
    const input = messageBody.parse(request.body);
    await permitted(id, uid);
    // Same sender and UUID must always resolve to the same immutable message.
    // An existing message with a different body is a rejected replay.
    const key = {
      conversationId_senderId_clientMessageId: {
        conversationId: id,
        senderId: uid,
        clientMessageId: input.clientMessageId,
      },
    };
    // A confirmed retry always returns the original message, including when
    // an account reaches the send limit or the shared product is unpublished.
    const verifyReplay = (message: {
      body: string;
      productId: string | null;
    }) => {
      if (
        message.body !== input.body ||
        message.productId !== (input.productId ?? null)
      )
        throw new AppError(
          409,
          "MESSAGE_REPLAY_CONFLICT",
          "Message request differs from the original",
        );
    };
    let created = await db().chatMessage.findUnique({
      where: key,
      select: messageSelect,
    });
    if (created) {
      verifyReplay(created);
      return reply.code(200).send({ data: created });
    }
    try {
      created = await db().$transaction(async (tx) => {
        // This transaction-level lock applies across API workers sharing
        // PostgreSQL, unlike per-process counters. We rate-limit only NEW sends.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"eazicart-chat-send:" + uid})::bigint) IS NULL AS locked`;
        const existing = await tx.chatMessage.findUnique({
          where: key,
          select: messageSelect,
        });
        if (existing) return existing;
        const state = await tx.conversation.findUniqueOrThrow({
          where: { id },
          select: { buyerBlockedAt: true, sellerBlockedAt: true },
        });
        if (state.buyerBlockedAt || state.sellerBlockedAt)
          throw new AppError(
            403,
            "CONVERSATION_BLOCKED",
            "Messaging is disabled in this conversation",
          );
        const recent = await tx.chatMessage.count({
          where: {
            senderId: uid,
            createdAt: { gte: new Date(Date.now() - 60_000) },
          },
        });
        if (recent >= 20)
          throw new AppError(
            429,
            "CHAT_RATE_LIMIT",
            "Too many messages. Please try again shortly",
          );
        if (input.productId) {
          const conversation = await tx.conversation.findUniqueOrThrow({
            where: { id },
            select: { sellerId: true },
          });
          const product = await tx.product.findFirst({
            where: {
              id: input.productId,
              active: true,
              seller: { userId: conversation.sellerId },
            },
            select: { id: true },
          });
          if (!product)
            throw new AppError(
              404,
              "PRODUCT_NOT_FOUND",
              "Product is unavailable",
            );
        }
        const inserted = await tx.chatMessage.create({
          data: {
            conversationId: id,
            senderId: uid,
            clientMessageId: input.clientMessageId,
            body: input.body,
            productId: input.productId,
          },
          select: messageSelect,
        });
        await tx.conversation.updateMany({
          where: { id, updatedAt: { lt: inserted.createdAt } },
          data: { updatedAt: inserted.createdAt },
        });
        return inserted;
      });
    } catch (error) {
      // Another request may have inserted an identical UUID concurrently.
      // Never hide unrelated database failures or bypass replay validation.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      created = await db().chatMessage.findUnique({
        where: key,
        select: messageSelect,
      });
      if (!created) throw error;
    }
    verifyReplay(created);
    return reply.code(200).send({ data: created });
  });
}
