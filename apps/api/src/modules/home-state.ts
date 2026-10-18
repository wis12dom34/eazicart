import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { protectedRoute, requireDatabase, userId } from "./shared.js";

// Small Home-only payload: avoid downloading the full cart, notification list and
// hydrated saved products just to render badges/hearts on the feed.
export function registerHomeState(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client), auth = protectedRoute(app);
  app.get("/home/state", auth, async (request) => {
    const uid = userId(request);
    const [cart, unreadCount, saved] = await db().$transaction([
      db().cart.findUnique({
        where: { userId: uid },
        select: { items: { select: { quantity: true } } },
      }),
      db().notification.count({ where: { userId: uid, readAt: null } }),
      db().savedProduct.findMany({
        where: { userId: uid },
        select: { productId: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      data: {
        cartCount: cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
        unreadCount,
        savedProductIds: saved.map((item) => item.productId),
      },
    };
  });
}