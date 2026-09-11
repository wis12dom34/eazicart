import type { FastifyInstance } from "fastify";

export function registerCategories(app: FastifyInstance) {
  app.get("/categories", async () => ({ data: [] }));
}
