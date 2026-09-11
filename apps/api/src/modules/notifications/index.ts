import type { FastifyInstance } from "fastify";

export function registerNotifications(app: FastifyInstance) {
  app.get("/notifications", { preHandler: app.authenticate }, async () => ({
    data: [],
  }));
}
