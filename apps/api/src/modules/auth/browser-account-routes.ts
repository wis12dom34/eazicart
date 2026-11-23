import argon2 from "argon2";
import { SignJWT } from "jose";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import type { AppConfig } from "../../config.js";
import type { AuthStore } from "./store.js";
import type { BrowserAccountStore } from "./browser-account-store.js";
import {
  deviceCookie,
  deviceSecret,
  digestSecret,
  requireSameOrigin,
} from "./browser-account-security.js";

// Candidate-only routes: not registered in production. The browser device
// credential is HttpOnly, not an account token stored in browser JavaScript.
import { readBrowserDeviceHash } from "./browser-account-access.js";

const accountId = z.object({ userId: z.string().min(1).max(128) });
const loginBody = z.object({
  email: z.email().transform((x) => x.toLowerCase()),
  password: z.string().min(8).max(128),
});
export function registerBrowserAccountRoutes(
  app: FastifyInstance,
  config: AppConfig,
  users: AuthStore,
  accounts: BrowserAccountStore,
  { enableSwitch = false } = {},
) {
  const ttl = config.REFRESH_TOKEN_TTL_DAYS * 86400;
  const requireDevice = async (request: FastifyRequest) => {
    const hash = readBrowserDeviceHash(request);
    const device = hash ? await accounts.findDevice(hash) : undefined;
    if (!device)
      throw new AppError(
        401,
        "DEVICE_SESSION_EXPIRED",
        "Sign in again to add accounts",
      );
    return device;
  };
  const publicAccount = async (userId: string) => {
    const user = await users.findUserById(userId);
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  };
  const issueAccess = (deviceId: string, userId: string, generation: string) =>
    new SignJWT({
      browserDevice: deviceId,
      browserGeneration: digestSecret(generation),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(config.ACCESS_TOKEN_TTL)
      .sign(new TextEncoder().encode(config.JWT_SECRET));
  const session = (
    reply: FastifyReply,
    user: NonNullable<Awaited<ReturnType<typeof publicAccount>>>,
    accessToken: string,
    expiresAt: Date,
  ) => {
    reply.header("Cache-Control", "private, no-store");
    return {
      user,
      tokens: { accessToken },
      sessionExpiresAt: expiresAt.toISOString(),
    };
  };
  app.post("/auth/browser/device", async (request, reply) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const existingHash = readBrowserDeviceHash(request);
    const existing = existingHash
      ? await accounts.findDevice(existingHash)
      : undefined;
    if (existing) return { activeUserId: existing.activeUserId };
    const secret = deviceSecret();
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const device = await accounts.createDevice(digestSecret(secret), expiresAt);
    reply.header("Set-Cookie", deviceCookie(secret, ttl));
    return { activeUserId: device.activeUserId };
  });
  app.post("/auth/browser/accounts", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    const entries = await accounts.listAccounts(device.id);
    const users = await Promise.all(
      entries.map((entry) => publicAccount(entry.userId)),
    );
    return {
      activeUserId: device.activeUserId,
      accounts: users.filter(Boolean),
    };
  });
  app.post("/auth/browser/add", async (request, reply) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    if (!enableSwitch)
      throw new AppError(
        503,
        "MULTI_ACCOUNT_NOT_READY",
        "Secure account switching is not yet enabled",
      );
    const input = loginBody.parse(request.body);
    const user = await users.findUserByEmail(input.email);
    if (!user || !(await argon2.verify(user.passwordHash, input.password)))
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    const generation = digestSecret(deviceSecret());
    const accessToken = await issueAccess(device.id, user.id, generation);
    await accounts.addAccount(device.id, {
      userId: user.id,
      refreshTokenHash: generation,
      expiresAt: device.expiresAt,
    });
    return session(
      reply,
      { id: user.id, name: user.name, email: user.email },
      accessToken,
      device.expiresAt,
    );
  });
  app.post("/auth/browser/session", async (request, reply) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    if (!enableSwitch)
      throw new AppError(
        503,
        "MULTI_ACCOUNT_NOT_READY",
        "Secure account switching is not yet enabled",
      );
    const userId = device.activeUserId;
    const generation =
      userId &&
      (await accounts.findActiveGeneration(
        device.id,
        device.secretHash,
        userId,
      ));
    const user = userId && generation ? await publicAccount(userId) : null;
    const account =
      user &&
      (await accounts.listAccounts(device.id)).find(
        (entry) =>
          entry.userId === userId && entry.refreshTokenHash === generation,
      );
    if (!user || !generation || !account)
      throw new AppError(
        401,
        "BROWSER_ACCOUNT_EXPIRED",
        "Sign in to this account again",
      );
    return session(
      reply,
      user,
      await issueAccess(device.id, user.id, generation),
      account.expiresAt,
    );
  });
  app.post("/auth/browser/switch", async (request, reply) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    const { userId } = accountId.parse(request.body);
    if (!enableSwitch)
      throw new AppError(
        503,
        "MULTI_ACCOUNT_NOT_READY",
        "Secure account switching is not yet enabled",
      );

    const account = (await accounts.listAccounts(device.id)).find(
      (entry) => entry.userId === userId,
    );
    const user = account ? await publicAccount(userId) : null;
    if (!account || !user)
      throw new AppError(
        401,
        "BROWSER_ACCOUNT_EXPIRED",
        "Sign in to this account again",
      );
    const nextHash = digestSecret(deviceSecret());
    const accessToken = await issueAccess(device.id, userId, nextHash);
    if (
      !(await accounts.activateAccount({
        deviceId: device.id,
        expectedActiveUserId: device.activeUserId,
        userId,
        expectedHash: account.refreshTokenHash,
        nextHash,
      }))
    ) {
      throw new AppError(
        409,
        "BROWSER_ACCOUNT_CHANGED",
        "Account state changed. Reload the account list and retry.",
      );
    }
    return session(reply, user, accessToken, account.expiresAt);
  });
  app.post("/auth/browser/remove", async (request) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    const { userId } = accountId.parse(request.body);
    return { removed: await accounts.removeAccount(device.id, userId) };
  });
  app.post("/auth/browser/logout-all", async (request) => {
    requireSameOrigin(request, config.WEB_ORIGIN);
    const device = await requireDevice(request);
    await accounts.removeAllAccounts(device.id);
    return { success: true };
  });
}
