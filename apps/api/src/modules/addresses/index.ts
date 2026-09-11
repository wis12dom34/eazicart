import type { FastifyInstance } from "fastify";

export function registerAddresses(app: FastifyInstance) {
  app.get("/addresses", { preHandler: app.authenticate }, async () => ({
    data: [],
  }));
}
