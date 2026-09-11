import type { FastifyInstance } from "fastify";

export function registerNotifications(app: FastifyInstance) {
  app.get(
    "/notifications",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
