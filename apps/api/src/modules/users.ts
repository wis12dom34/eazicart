import type { FastifyInstance } from "fastify";
import { AppError } from "../errors.js";
import type { AuthStore } from "./auth/store.js";
import type { PrismaClient } from "@eazicart/database";
import { z } from "zod";
import { requireDatabase, userId } from "./shared.js";

export function registerUsers(
  app: FastifyInstance,
  store: AuthStore,
  database?: PrismaClient,
) {
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
  app.patch(
    "/users/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const input = z
        .object({ name: z.string().trim().min(2).max(100) })
        .parse(request.body);
      const data = await requireDatabase(database).user.update({
        where: { id: userId(request) },
        data: input,
        select: { id: true, email: true, name: true },
      });
      return { data };
    },
  );
}
