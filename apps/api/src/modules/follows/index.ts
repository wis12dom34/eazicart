import type { FastifyInstance } from "fastify";

export function registerFollows(app: FastifyInstance) {
  app.get("/follows", { preHandler: app.authenticate }, async () => ({
    data: [],
  }));
}
