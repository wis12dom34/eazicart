import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../packages/database/dist/index.js";

export async function markOrderPaid(orderId) {
  const db = new PrismaClient();
  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
          items: { include: { product: { select: { sellerId: true } } } },
        },
      });
      if (!order) throw new Error(`Order ${orderId} not found`);
      if (order.payment?.status === "SUCCESS") return;

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      const reference = `E2E-${randomUUID()}`;
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            reference,
            status: "SUCCESS",
            amount: order.total,
            paidAt: new Date(),
            providerTransactionId: `E2E-${randomUUID()}`,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            reference,
            status: "SUCCESS",
            amount: order.total,
            paidAt: new Date(),
            providerTransactionId: `E2E-${randomUUID()}`,
          },
        });
      }
      const sellerIds = [
        ...new Set(order.items.map((item) => item.product.sellerId)),
      ];
      await tx.sellerFulfillment.createMany({
        data: sellerIds.map((sellerId) => ({ orderId: order.id, sellerId })),
        skipDuplicates: true,
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });
    });
  } finally {
    await db.$disconnect();
  }
}
