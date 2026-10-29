import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@eazicart/database";
import { buildApp } from "../src/app.js";
import { PrismaAuthStore } from "../src/modules/auth/prisma-store.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  DATABASE_URL: "postgresql://localhost/eazicart",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  WEB_ORIGIN: "http://localhost:3000",
};
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

async function fixture() {
  let user: Record<string, unknown>;
  const update = vi.fn(
    ({
      data,
      where,
    }: {
      data: Record<string, unknown>;
      where: { id: string };
    }) => {
      expect(where.id).toBe(user.id);
      Object.assign(
        user,
        Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined),
        ),
      );
      const { id, name, email, username = null, bio = null } = user;
      return Promise.resolve({ id, name, email, username, bio });
    },
  );
  const database = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(user ?? null)),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve((user = { ...data, id: "profile-user" })),
      ),
      update,
    },
    refreshToken: { create: vi.fn() },
  } as unknown as PrismaClient;
  const app = buildApp(config, {
    database,
    authStore: new PrismaAuthStore(database),
  });
  apps.push(app);
  const registration = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "profile@example.com",
      name: "Profile Customer",
      password: "correct-horse",
    },
  });
  expect(registration.statusCode).toBe(201);
  const headers = {
    authorization: `Bearer ${registration.json<{ data: Record<string, unknown>; user: Record<string, unknown>; tokens: { accessToken: string }; error: { code: string } }>().tokens.accessToken}`,
  };
  return { app, headers, update };
}

describe("profile API and auth persistence", () => {
  it("normalizes username and retains profile fields in reload and login responses", async () => {
    const { app, headers } = await fixture();
    const saved = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers,
      payload: {
        name: "Updated Customer",
        username: "  Wick_123  ",
        bio: "  A short bio  ",
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(
      saved.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().data,
    ).toMatchObject({
      username: "wick_123",
      bio: "A short bio",
    });
    const reload = await app.inject({
      method: "GET",
      url: "/users/me",
      headers,
    });
    expect(
      reload.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>(),
    ).toMatchObject({
      name: "Updated Customer",
      username: "wick_123",
      bio: "A short bio",
    });
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "profile@example.com",
        password: "correct-horse",
      },
    });
    expect(
      login.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().user,
    ).toMatchObject({
      username: "wick_123",
      bio: "A short bio",
    });
    expect(
      login.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().user,
    ).not.toHaveProperty("passwordHash");
    const legacy = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers,
      payload: { name: "Legacy Client" },
    });
    expect(legacy.statusCode).toBe(200);
    expect(
      legacy.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().data,
    ).toMatchObject({
      username: "wick_123",
      bio: "A short bio",
    });
    const clear = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers,
      payload: { name: "Legacy Client", bio: "" },
    });
    expect(
      clear.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().data.bio,
    ).toBeNull();
  });

  it("rejects invalid usernames and unauthenticated writes without touching data", async () => {
    const { app, headers, update } = await fixture();
    for (const username of ["ab", "x".repeat(31), "bad-name", "with space"]) {
      const result = await app.inject({
        method: "PATCH",
        url: "/users/me",
        headers,
        payload: { name: "Customer", username },
      });
      expect(result.statusCode).toBe(400);
    }
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/users/me",
          payload: { name: "Customer" },
        })
      ).statusCode,
    ).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns a useful conflict when the unique username constraint rejects a write", async () => {
    const { app, headers, update } = await fixture();
    update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "6",
      }),
    );
    const result = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers,
      payload: { name: "Customer", username: "taken" },
    });
    expect(result.statusCode).toBe(409);
    expect(
      result.json<{
        data: Record<string, unknown>;
        user: Record<string, unknown>;
        tokens: { accessToken: string };
        error: { code: string };
      }>().error.code,
    ).toBe("USERNAME_IN_USE");
  });
});
