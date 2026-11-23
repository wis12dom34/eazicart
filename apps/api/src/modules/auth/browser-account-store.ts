import { randomUUID } from "node:crypto";

export interface BrowserAccountRecord {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}
export interface BrowserDeviceRecord {
  id: string;
  secretHash: string;
  activeUserId: string | null;
  expiresAt: Date;
}
export interface BrowserAccountActivation {
  deviceId: string;
  expectedActiveUserId: string | null;
  userId: string;
  expectedHash: string;
  nextHash: string;
}

export interface BrowserAccountStore {
  activateAccount(input: BrowserAccountActivation): Promise<boolean>;
  createDevice(
    secretHash: string,
    expiresAt: Date,
  ): Promise<BrowserDeviceRecord>;
  findDevice(secretHash: string): Promise<BrowserDeviceRecord | undefined>;
  findActiveGeneration(
    deviceId: string,
    secretHash: string,
    userId: string,
  ): Promise<string | undefined>;
  addAccount(
    deviceId: string,
    account: BrowserAccountRecord,
    verifiedPasswordHash?: string,
  ): Promise<boolean>;
  listAccounts(deviceId: string): Promise<BrowserAccountRecord[]>;
  selectAccount(deviceId: string, userId: string): Promise<boolean>;
  rotateAccountToken(
    deviceId: string,
    userId: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean>;
  removeAccount(deviceId: string, userId: string): Promise<boolean>;
  removeAllAccounts(deviceId: string): Promise<void>;
}

// Test-only implementation. Production MUST use a transactional persistent
// store; an in-memory store loses accounts on restart and is not multi-worker safe.
export class MemoryBrowserAccountStore implements BrowserAccountStore {
  private devices = new Map<string, BrowserDeviceRecord>();
  private accounts = new Map<string, Map<string, BrowserAccountRecord>>();
  async createDevice(secretHash: string, expiresAt: Date) {
    const device = {
      id: randomUUID(),
      secretHash,
      activeUserId: null,
      expiresAt,
    };
    this.devices.set(secretHash, device);
    this.accounts.set(device.id, new Map());
    return { ...device };
  }
  async findDevice(secretHash: string) {
    const device = this.devices.get(secretHash);
    return device && device.expiresAt > new Date() ? { ...device } : undefined;
  }
  async findActiveGeneration(
    deviceId: string,
    secretHash: string,
    userId: string,
  ) {
    const device = this.devices.get(secretHash);
    const account = this.accounts.get(deviceId)?.get(userId);
    const now = new Date();
    if (
      device?.id !== deviceId ||
      device.activeUserId !== userId ||
      device.expiresAt <= now ||
      !account ||
      account.revokedAt ||
      account.expiresAt <= now
    )
      return undefined;
    return account.refreshTokenHash;
  }
  async addAccount(deviceId: string, account: BrowserAccountRecord) {
    const accounts = this.accounts.get(deviceId);
    if (!accounts) throw new Error("Unknown device");
    accounts.set(account.userId, { ...account });
    const device = [...this.devices.values()].find(
      (value) => value.id === deviceId,
    );
    if (device) device.activeUserId = account.userId;
    return true;
  }
  async listAccounts(deviceId: string) {
    return [...(this.accounts.get(deviceId)?.values() ?? [])]
      .filter((item) => !item.revokedAt && item.expiresAt > new Date())
      .map((item) => ({ ...item }));
  }
  async activateAccount(input: BrowserAccountActivation) {
    const device = [...this.devices.values()].find(
      ({ id }) => id === input.deviceId,
    );
    const account = this.accounts.get(input.deviceId)?.get(input.userId);
    const now = new Date();
    if (
      !device ||
      device.expiresAt <= now ||
      device.activeUserId !== input.expectedActiveUserId ||
      !account ||
      account.revokedAt ||
      account.expiresAt <= now ||
      account.refreshTokenHash !== input.expectedHash
    )
      return false;
    account.refreshTokenHash = input.nextHash;
    device.activeUserId = input.userId;
    return true;
  }
  async selectAccount(deviceId: string, userId: string) {
    const account = this.accounts.get(deviceId)?.get(userId);
    const device = [...this.devices.values()].find(
      (value) => value.id === deviceId,
    );
    if (
      !account ||
      !device ||
      account.revokedAt ||
      account.expiresAt <= new Date()
    )
      return false;
    device.activeUserId = userId;
    return true;
  }
  async rotateAccountToken(
    deviceId: string,
    userId: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
  ) {
    const account = this.accounts.get(deviceId)?.get(userId);
    if (
      !account ||
      account.revokedAt ||
      account.expiresAt <= new Date() ||
      account.refreshTokenHash !== previousHash
    )
      return false;
    account.refreshTokenHash = nextHash;
    account.expiresAt = expiresAt;
    return true;
  }
  async removeAccount(deviceId: string, userId: string) {
    const accounts = this.accounts.get(deviceId);
    const removed = accounts?.delete(userId) ?? false;
    const device = [...this.devices.values()].find(
      (value) => value.id === deviceId,
    );
    if (removed && device?.activeUserId === userId) device.activeUserId = null;
    return removed;
  }
  async removeAllAccounts(deviceId: string) {
    this.accounts.get(deviceId)?.clear();
    const device = [...this.devices.values()].find(
      (value) => value.id === deviceId,
    );
    if (device) device.activeUserId = null;
  }
}
