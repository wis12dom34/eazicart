import { Prisma, type PrismaClient } from "@eazicart/database";
import { EmailAlreadyExistsError, type AuthStore } from "./store.js";

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
    try {
      return await this.database.user.create({
        data: input,
        select: { id: true, email: true, name: true, passwordHash: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new EmailAlreadyExistsError();
      throw error;
    }
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.database.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async revokeRefreshTokens(userId: string) {
    await this.database.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
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
      const consumed = await transaction.refreshToken.updateMany({
        where: {
          id: token.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      return consumed.count === 1 ? token.userId : undefined;
    });
  }
}
