import type { FastifyInstance } from "fastify";

export function registerProducts(app: FastifyInstance) {
  app.get("/products", () => ({ data: [] }));
}
