import type { FastifyInstance } from "fastify";

export function registerFollows(app: FastifyInstance) {
  app.get(
    "/follows",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
