import type { FastifyInstance } from "fastify";

export function registerCart(app: FastifyInstance) {
  app.get(
    "/cart",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
