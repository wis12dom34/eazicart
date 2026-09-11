import type { FastifyInstance } from "fastify";

export function registerSavedProducts(app: FastifyInstance) {
  app.get(
    "/saved-products",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
