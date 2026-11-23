import type { PrismaClient } from "@eazicart/database";
import type {
  BrowserAccountActivation,
  BrowserAccountRecord,
  BrowserAccountStore,
  BrowserDeviceRecord,
} from "./browser-account-store.js";

// Isolated candidate only. Requires generated Prisma client from the proposed
// additive schema and a reviewed migration before activation.
export class PrismaBrowserAccountStore implements BrowserAccountStore {
  constructor(private readonly db: PrismaClient) {}

  async createDevice(
    secretHash: string,
    expiresAt: Date,
  ): Promise<BrowserDeviceRecord> {
    return this.db.browserDevice.create({
      data: { secretHash, expiresAt },
      select: {
        id: true,
        secretHash: true,
        activeUserId: true,
        expiresAt: true,
      },
    });
  }
  async findDevice(
    secretHash: string,
  ): Promise<BrowserDeviceRecord | undefined> {
    return (
      (await this.db.browserDevice.findFirst({
        where: { secretHash, expiresAt: { gt: new Date() } },
        select: {
          id: true,
          secretHash: true,
          activeUserId: true,
          expiresAt: true,
        },
      })) ?? undefined
    );
  }
  async findActiveGeneration(
    deviceId: string,
    secretHash: string,
    userId: string,
  ) {
    const now = new Date();
    const row = await this.db.browserAccount.findFirst({
      where: {
        deviceId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        device: { secretHash, activeUserId: userId, expiresAt: { gt: now } },
      },
      select: { refreshTokenHash: true },
    });
    return row?.refreshTokenHash;
  }
  async addAccount(
    deviceId: string,
    account: BrowserAccountRecord,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const device = await tx.browserDevice.findFirst({
        where: { id: deviceId, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (!device) throw new Error("Unknown or expired browser device");
      await tx.browserAccount.upsert({
        where: { deviceId_userId: { deviceId, userId: account.userId } },
        create: {
          deviceId,
          userId: account.userId,
          refreshTokenHash: account.refreshTokenHash,
          expiresAt: account.expiresAt,
        },
        update: {
          refreshTokenHash: account.refreshTokenHash,
          expiresAt: account.expiresAt,
          revokedAt: null,
        },
      });
      await tx.browserDevice.update({
        where: { id: deviceId },
        data: { activeUserId: account.userId },
      });
    });
  }
  async listAccounts(deviceId: string): Promise<BrowserAccountRecord[]> {
    return this.db.browserAccount
      .findMany({
        where: {
          deviceId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          device: { expiresAt: { gt: new Date() } },
        },
        select: {
          userId: true,
          refreshTokenHash: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
      .then((rows) =>
        rows.map((row) => ({ ...row, revokedAt: row.revokedAt ?? undefined })),
      );
  }
  async activateAccount(input: BrowserAccountActivation): Promise<boolean> {
    const rejected = new Error("Browser account activation changed");
    try {
      return await this.db.$transaction(async (tx) => {
        const now = new Date();
        const updated = await tx.browserAccount.updateMany({
          where: {
            deviceId: input.deviceId,
            userId: input.userId,
            refreshTokenHash: input.expectedHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { refreshTokenHash: input.nextHash },
        });
        if (updated.count !== 1) return false;
        const selected = await tx.browserDevice.updateMany({
          where: {
            id: input.deviceId,
            activeUserId: input.expectedActiveUserId,
            expiresAt: { gt: new Date() },
          },
          data: { activeUserId: input.userId },
        });
        if (selected.count !== 1) throw rejected;
        return true;
      });
    } catch (error) {
      if (error === rejected) return false;
      throw error;
    }
  }
  async selectAccount(deviceId: string, userId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const account = await tx.browserAccount.findFirst({
        where: {
          deviceId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
          device: { expiresAt: { gt: now } },
        },
        select: { id: true },
      });
      if (!account) return false;
      const changed = await tx.browserDevice.updateMany({
        where: { id: deviceId, expiresAt: { gt: now } },
        data: { activeUserId: userId },
      });
      return changed.count === 1;
    });
  }
  async rotateAccountToken(
    deviceId: string,
    userId: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const updated = await this.db.browserAccount.updateMany({
      where: {
        deviceId,
        userId,
        refreshTokenHash: previousHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        device: { expiresAt: { gt: new Date() } },
      },
      data: { refreshTokenHash: nextHash, expiresAt },
    });
    return updated.count === 1;
  }
  async removeAccount(deviceId: string, userId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.browserAccount.updateMany({
        where: { deviceId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count)
        await tx.browserDevice.updateMany({
          where: { id: deviceId, activeUserId: userId },
          data: { activeUserId: null },
        });
      return updated.count === 1;
    });
  }
  async removeAllAccounts(deviceId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.browserAccount.updateMany({
        where: { deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.browserDevice.updateMany({
        where: { id: deviceId },
        data: { activeUserId: null },
      });
    });
  }
}
