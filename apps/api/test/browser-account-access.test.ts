import Fastify from "fastify";
import { SignJWT } from "jose";
import { expect, it } from "vitest";
import { registerBrowserAccountRoutes } from "../src/modules/auth/browser-account-routes.js";
import { registerAuth } from "../src/modules/auth/index.js";
import { MemoryBrowserAccountStore } from "../src/modules/auth/browser-account-store.js";
import {
  DEVICE_COOKIE,
  deviceSecret,
  digestSecret,
} from "../src/modules/auth/browser-account-security.js";

it("requires matching browser, active account and live generation for browser JWTs", async () => {
  const app = Fastify();
  const accounts = new MemoryBrowserAccountStore();
  const config = {
    JWT_SECRET: "fixture-only-key",
    WEB_ORIGIN: "https://eazicart.com",
    ACCESS_TOKEN_TTL: "1m",
    REFRESH_TOKEN_TTL_DAYS: 30,
  } as Parameters<typeof registerAuth>[1];
  const users = {
    findUserById: async (id: string) => ({ id, name: id }),
  } as Parameters<typeof registerAuth>[2];
  registerAuth(app, config, users, accounts);
  registerBrowserAccountRoutes(app, config, users, accounts, {
    enableSwitch: true,
  });
  app.get("/fixture", { preHandler: app.authenticate }, async ({ userId }) => ({
    userId,
  }));

  try {
    const rawDevice = deviceSecret();
    const expiresAt = new Date(Date.now() + 60_000);
    const device = await accounts.createDevice(
      digestSecret(rawDevice),
      expiresAt,
    );
    const firstHash = digestSecret(deviceSecret());
    const secondHash = digestSecret(deviceSecret());
    await accounts.addAccount(device.id, {
      userId: "first",
      refreshTokenHash: firstHash,
      expiresAt,
    });
    const claims = {
      browserDevice: device.id,
      browserGeneration: digestSecret(firstHash),
    };
    const sign = (payload = {}) =>
      new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("first")
        .setExpirationTime("1m")
        .sign(new TextEncoder().encode(config.JWT_SECRET));
    const original = await sign(claims);
    const cookie = DEVICE_COOKIE + "=" + rawDevice;
    const request = (token: string, deviceCookie?: string) =>
      app.inject({
        url: "/fixture",
        headers: {
          authorization: "Bearer " + token,
          ...(deviceCookie ? { cookie: deviceCookie } : {}),
        },
      });

    expect((await request(original, cookie)).statusCode).toBe(200);
    expect((await request(original)).statusCode).toBe(401);
    expect((await request(original, cookie + "; " + cookie)).statusCode).toBe(
      401,
    );
    expect(
      (await request(await sign({ browserDevice: device.id }), cookie))
        .statusCode,
    ).toBe(401);

    await accounts.addAccount(device.id, {
      userId: "second",
      refreshTokenHash: secondHash,
      expiresAt,
    });
    expect((await request(original, cookie)).statusCode).toBe(401);
    const switched = await app.inject({
      method: "POST",
      url: "/auth/browser/switch",
      headers: { origin: config.WEB_ORIGIN, cookie },
      payload: { userId: "first" },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.headers["cache-control"]).toBe("private, no-store");
    expect((await request(original, cookie)).statusCode).toBe(401);
    const current = switched.json().tokens.accessToken;
    expect((await request(current, cookie)).statusCode).toBe(200);
    await accounts.removeAccount(device.id, "first");
    expect((await request(current, cookie)).statusCode).toBe(401);
    expect((await request(await sign())).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
