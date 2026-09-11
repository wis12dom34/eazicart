import type { FastifyInstance } from "fastify";

export function registerSellerProfiles(app: FastifyInstance) {
  app.get(
    "/seller-profiles",
    { preHandler: (request) => app.authenticate(request) },
    () => ({ data: [] }),
  );
}
