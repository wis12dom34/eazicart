import type { FastifyInstance } from "fastify";

export function registerSellerProfiles(app: FastifyInstance) {
  app.get("/seller-profiles", { preHandler: app.authenticate }, async () => ({
    data: [],
  }));
}
