import type { FastifyInstance } from "fastify";

export function registerAddresses(app: FastifyInstance) {
  app.get(
    "/addresses",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
