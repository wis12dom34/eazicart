import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

export function registerOrderTracking(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  app.get(
    "/orders/:id/fulfillments",
    protectedRoute(app),
    async (request, reply) => {
      const { id } = z
        .object({ id: z.string().min(1).max(100) })
        .parse(request.params);
      const row = await requireDatabase(client).order.findFirst({
        where: { id, userId: userId(request) },
        select: {
          id: true,
          payment: { select: { status: true, paidAt: true } },
          fulfillments: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              seller: { select: { id: true, displayName: true } },
              events: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true, status: true, createdAt: true },
              },
            },
          },
        },
      });
      if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
      reply.header("Cache-Control", "private, no-store");
      return {
        data: {
          orderId: row.id,
          paymentConfirmed:
            row.payment?.status === "SUCCESS" && Boolean(row.payment.paidAt),
          fulfillments: row.fulfillments,
          capabilities: { liveLocation: false, carrierTracking: false },
        },
      };
    },
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]