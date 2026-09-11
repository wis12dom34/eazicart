import type { PrismaClient } from "@eazicart/database";
import type { AuthStore } from "./store.js";

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly database: PrismaClient) {}

  async findUserByEmail(email: string) {
    return (
      (await this.database.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, passwordHash: true },
      })) ?? undefined
    );
  }

  async findUserById(id: string) {
    return (
      (await this.database.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, passwordHash: true },
      })) ?? undefined
    );
  }

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
  }) {
    return this.database.user.create({
      data: input,
      select: { id: true, email: true, name: true, passwordHash: true },
    });
  }

  async saveRefreshToken(input: {
    hash: string;
    userId: string;
    expiresAt: Date;
  }) {
    await this.database.refreshToken.create({
      data: {
        tokenHash: input.hash,
        userId: input.userId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async consumeRefreshToken(hash: string) {
    return this.database.$transaction(async (transaction) => {
      const token = await transaction.refreshToken.findUnique({
        where: { tokenHash: hash },
      });
      if (!token || token.revokedAt || token.expiresAt <= new Date())
        return undefined;
      await transaction.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
      return token.userId;
    });
  }
}
