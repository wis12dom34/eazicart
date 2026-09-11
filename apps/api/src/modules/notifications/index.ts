import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
export function registerNotifications(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app);
  app.get("/notifications", auth, async (r) => {
    const uid = userId(r);
    const [data, unreadCount] = await db().$transaction([
      db().notification.findMany({
        where: { userId: uid },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db().notification.count({ where: { userId: uid, readAt: null } }),
    ]);
    return { data, meta: { unreadCount } };
  });
  app.patch("/notifications/read-all", auth, async (r) => {
    const result = await db().notification.updateMany({
      where: { userId: userId(r), readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { updated: result.count } };
  });
  app.patch("/notifications/:id/read", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const row = await db().notification.findFirst({
      where: { id, userId: userId(r) },
    });
    if (!row)
      throw new AppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notification not found",
      );
    return {
      data: await db().notification.update({
        where: { id },
        data: { readAt: row.readAt ?? new Date() },
      }),
    };
  });
}
