import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerBrowserAccountRoutes } from "../src/modules/auth/browser-account-routes.js";
import { MemoryBrowserAccountStore } from "../src/modules/auth/browser-account-store.js";
import { DEVICE_COOKIE } from "../src/modules/auth/browser-account-security.js";
const origin = "https://eazicart.com";
const config = {
  WEB_ORIGIN: origin,
  REFRESH_TOKEN_TTL_DAYS: 30,
  JWT_SECRET: "test-only",
  ACCESS_TOKEN_TTL: "15m",
} as Parameters<typeof registerBrowserAccountRoutes>[1];
const users = {
  findUserByEmail: async () => undefined,
  findUserById: async () => undefined,
} as unknown as Parameters<typeof registerBrowserAccountRoutes>[2];
async function setup() {
  const app = Fastify();
  registerBrowserAccountRoutes(
    app,
    config,
    users,
    new MemoryBrowserAccountStore(),
  );
  return app;
}
describe("unreleased browser-account endpoints", () => {
  it("rejects missing or cross-site Origin on cookie creation", async () => {
    const app = await setup();
    for (const headers of [
      {},
      { origin: "https://attacker.example" },
      { origin, "sec-fetch-site": "cross-site" },
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/browser/device",
        headers,
      });
      expect(res.statusCode).toBe(403);
    }
    await app.close();
  });
  it("issues HttpOnly device cookie and reuses same browser device", async () => {
    const app = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/auth/browser/device",
      headers: { origin, "sec-fetch-site": "same-origin" },
    });
    expect(created.statusCode).toBe(200);
    const cookie = created.headers["set-cookie"] as string;
    expect(cookie).toContain(`${DEVICE_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    const existing = await app.inject({
      method: "POST",
      url: "/auth/browser/device",
      headers: { origin, cookie: cookie.split(";")[0] },
    });
    expect(existing.statusCode).toBe(200);
    expect(existing.headers["set-cookie"]).toBeUndefined();
    await app.close();
  });
  it("rejects account operations without device session", async () => {
    const app = await setup();
    for (const path of ["accounts", "switch", "remove", "logout-all", "add"]) {
      const response = await app.inject({
        method: "POST",
        url: `/auth/browser/${path}`,
        headers: { origin },
        payload: {
          userId: "a",
          email: "a@example.com",
          password: "password123",
        },
      });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });
});
describe("disabled switching does not mutate active identity", () => {
  it("returns 503 without selecting an account", async () => {
    const store = new MemoryBrowserAccountStore();
    const app = Fastify();
    registerBrowserAccountRoutes(app, config, users, store);
    const init = await app.inject({
      method: "POST",
      url: "/auth/browser/device",
      headers: { origin },
    });
    const cookie = (init.headers["set-cookie"] as string).split(";")[0];
    const secret = cookie?.split("=")[1];
    if (!secret) throw new Error("Device cookie missing");
    const { digestSecret } =
      await import("../src/modules/auth/browser-account-security.js");
    const device = await store.findDevice(digestSecret(secret));
    expect(device).toBeDefined();
    await store.addAccount(device!.id, {
      userId: "a",
      refreshTokenHash: "test-hash",
      expiresAt: new Date(Date.now() + 60000),
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/browser/switch",
      headers: { origin, cookie },
      payload: { userId: "a" },
    });
    expect(response.statusCode).toBe(503);
    expect((await store.findDevice(digestSecret(secret)))?.activeUserId).toBe(
      "a",
    );
    await app.close();
  });
});
