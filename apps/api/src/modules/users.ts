import type { FastifyInstance } from "fastify";
import { AppError } from "../errors.js";
import type { AuthStore } from "./auth/store.js";

export function registerUsers(app: FastifyInstance, store: AuthStore) {
  app.get(
    "/users/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const user = request.userId
        ? await store.findUserById(request.userId)
        : undefined;
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      return { id: user.id, email: user.email, name: user.name };
    },
  );
}
