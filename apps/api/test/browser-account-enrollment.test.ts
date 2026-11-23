import argon2 from "argon2";
import Fastify from "fastify";
import { expect, it } from "vitest";
import { registerAuth } from "../src/modules/auth/index.js";
import { registerBrowserAccountRoutes } from "../src/modules/auth/browser-account-routes.js";
import { MemoryBrowserAccountStore } from "../src/modules/auth/browser-account-store.js";
import { MemoryAuthStore } from "../src/modules/auth/store.js";

it("enrolls two accounts, restores the active account, and revokes switched and removed access", async () => {
  const app = Fastify();
  const accounts = new MemoryBrowserAccountStore();
  const users = new MemoryAuthStore();
  const password = "fixture-password";
  const passwordHash = await argon2.hash(password);
  const first = await users.createUser({
    email: "first@example.test",
    name: "First",
    passwordHash,
  });
  const second = await users.createUser({
    email: "second@example.test",
    name: "Second",
    passwordHash,
  });
  const origin = "https://preview.example.test";
  const config = {
    WEB_ORIGIN: origin,
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL_DAYS: 30,
    JWT_SECRET: "test-only",
  } as Parameters<typeof registerAuth>[1];
  registerAuth(app, config, users, accounts);
  registerBrowserAccountRoutes(app, config, users, accounts, {
    enableSwitch: true,
  });
  app.get(
    "/fixture/identity",
    { preHandler: app.authenticate },
    async (request) => ({ id: request.userId }),
  );
  try {
    const device = await app.inject({
      method: "POST",
      url: "/auth/browser/device",
      headers: { origin },
    });
    const cookie = device.headers["set-cookie"]?.toString().split(";")[0];
    expect(cookie).toBeTruthy();
    const post = (path: string, payload?: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: `/auth/browser/${path}`,
        headers: { origin, cookie },
        payload,
      });
    const identity = (token: string) =>
      app.inject({
        method: "GET",
        url: "/fixture/identity",
        headers: { cookie, authorization: `Bearer ${token}` },
      });

    expect(
      (
        await post("add", {
          email: first.email,
          password: "incorrect-password",
        })
      ).statusCode,
    ).toBe(401);
    const firstLogin = await post("add", { email: first.email, password });
    expect(firstLogin.statusCode).toBe(200);
    const secondLogin = await post("add", { email: second.email, password });
    expect(secondLogin.statusCode).toBe(200);
    expect(
      (await identity(firstLogin.json().tokens.accessToken)).statusCode,
    ).toBe(401);
    const restored = await post("session");
    expect(restored.statusCode).toBe(200);
    expect((await identity(restored.json().tokens.accessToken)).json()).toEqual(
      { id: second.id },
    );
    const switched = await post("switch", { userId: first.id });
    expect(switched.statusCode).toBe(200);
    expect((await identity(switched.json().tokens.accessToken)).json()).toEqual(
      { id: first.id },
    );
    expect(
      (await identity(firstLogin.json().tokens.accessToken)).statusCode,
    ).toBe(401);
    expect((await post("remove", { userId: first.id })).json()).toEqual({
      removed: true,
    });
    expect(
      (await identity(switched.json().tokens.accessToken)).statusCode,
    ).toBe(401);
    expect(
      (await post("accounts"))
        .json()
        .accounts.map((entry: { id: string }) => entry.id),
    ).toEqual([second.id]);
    expect((await post("logout-all")).statusCode).toBe(200);
    expect((await post("accounts")).json().accounts).toEqual([]);
  } finally {
    await app.close();
  }
});
