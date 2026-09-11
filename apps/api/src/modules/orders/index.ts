import type { FastifyInstance } from "fastify";

export function registerOrders(app: FastifyInstance) {
  app.get("/orders", { preHandler: app.authenticate }, async () => ({
    data: [],
  }));
}
