import type { FastifyInstance } from "fastify";
import { AppError } from "../errors.js";
import type { AuthStore } from "./auth/store.js";
import { Prisma, type PrismaClient } from "@eazicart/database";
import { z } from "zod";
import { requireDatabase, userId } from "./shared.js";
import argon2 from "argon2";

const profileInput = z.object({
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Username can only use letters, numbers and underscores"),
  bio: z.string().trim().max(160).optional().default(""),
});
const publicProfile = { id: true, email: true, name: true, username: true, bio: true } as const;

export function registerUsers(app: FastifyInstance, store: AuthStore, database?: PrismaClient) {
  app.get(
    "/users/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const user = request.userId ? await store.findUserById(request.userId) : undefined;
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      return { id: user.id, email: user.email, name: user.name, username: user.username ?? null, bio: user.bio ?? null };
    },
  );

  app.patch(
    "/users/me",
    { preHandler: (request) => app.authenticate(request) },
    async (request) => {
      const input = profileInput.parse(request.body);
      try {
        const data = await requireDatabase(database).user.update({
          where: { id: userId(request) },
          data: { name: input.name, username: input.username, bio: input.bio || null },
          select: publicProfile,
        });
        return { data };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          throw new AppError(409, "USERNAME_IN_USE", "That username is already taken");
        throw error;
      }
    },
  );

  app.post(
    "/users/me/password",
    { preHandler: (request) => app.authenticate(request) },
    async (request, reply) => {
      const input = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(8).max(128) })
        .refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"], message: "New password must be different" })
        .parse(request.body);
      const id = userId(request);
      const user = await store.findUserById(id);
      if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword)))
        throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
      await store.updatePassword(id, await argon2.hash(input.newPassword));
      await store.revokeRefreshTokens(id);
      return reply.code(204).send();
    },
  );
}
