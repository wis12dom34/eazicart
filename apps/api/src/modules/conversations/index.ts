import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

const conversationParams = z.object({ id: z.string().min(1) });
const startConversationBody = z.object({ sellerId: z.string().min(1) });
const sendMessageBody = z.object({
  body: z.string().trim().min(1).max(2000),
});

const conversationInclude = {
  buyer: { select: { id: true, name: true } },
  seller: {
    select: {
      id: true,
      displayName: true,
      user: { select: { id: true, name: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { sender: { select: { id: true, name: true } } },
  },
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export function registerConversations(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);

  const participantWhere = (uid: string) => ({
    OR: [{ buyerId: uid }, { seller: { is: { userId: uid } } }],
  });

  const requireConversation = async (id: string, uid: string) => {
    const conversation = await db().conversation.findFirst({
      where: { id, ...participantWhere(uid) },
      include: conversationInclude,
    });
    if (!conversation)
      throw new AppError(
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation not found",
      );
    return conversation;
  };

  app.get("/conversations", auth, async (request) => {
    const uid = userId(request);
    const data = await db().conversation.findMany({
      where: participantWhere(uid),
      include: conversationInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return { data };
  });

  app.post("/conversations", auth, async (request, reply) => {
    const uid = userId(request);
    const input = startConversationBody.parse(request.body);
    const seller = await db().sellerProfile.findUnique({
      where: { id: input.sellerId },
      select: { id: true, userId: true },
    });
    if (!seller)
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    if (seller.userId === uid)
      throw new AppError(
        400,
        "SELF_CONVERSATION",
        "You cannot message your own store",
      );

    const where = {
      buyerId_sellerId: { buyerId: uid, sellerId: seller.id },
    };
    const existing = await db().conversation.findUnique({
      where,
      include: conversationInclude,
    });
    if (existing) return reply.send({ data: existing });

    try {
      const data = await db().conversation.create({
        data: { buyerId: uid, sellerId: seller.id },
        include: conversationInclude,
      });
      return reply.code(201).send({ data });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const raced = await db().conversation.findUnique({
        where,
        include: conversationInclude,
      });
      if (!raced) throw error;
      return reply.send({ data: raced });
    }
  });

  app.get("/conversations/:id/messages", auth, async (request) => {
    const uid = userId(request);
    const { id } = conversationParams.parse(request.params);
    const conversation = await requireConversation(id, uid);

    await db().conversation.update({
      where: { id },
      data:
        conversation.buyerId === uid
          ? { buyerUnreadCount: 0 }
          : { sellerUnreadCount: 0 },
    });

    const rows = await db().message.findMany({
      where: { conversationId: id },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: rows.reverse() };
  });

  app.post("/conversations/:id/messages", auth, async (request, reply) => {
    const uid = userId(request);
    const { id } = conversationParams.parse(request.params);
    const input = sendMessageBody.parse(request.body);
    const conversation = await requireConversation(id, uid);
    const unreadUpdate =
      conversation.buyerId === uid
        ? { sellerUnreadCount: { increment: 1 } }
        : { buyerUnreadCount: { increment: 1 } };

    const [data] = await db().$transaction([
      db().message.create({
        data: { conversationId: id, senderId: uid, body: input.body },
        include: { sender: { select: { id: true, name: true } } },
      }),
      db().conversation.update({
        where: { id },
        data: { updatedAt: new Date(), ...unreadUpdate },
      }),
    ]);

    return reply.code(201).send({ data });
  });
}
