import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryAuthStore } from "../src/modules/auth/store.js";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { PrismaClient } from "@eazicart/database";

interface PublicUserResponse {
  id: string;
  email: string;
  name: string;
}

interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AuthResponse {
  user: PublicUserResponse;
  tokens: AuthTokensResponse;
}

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
const makeApp = () => {
  const app = buildApp(config);
  apps.push(app);
  return app;
};
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("API foundation", () => {
  it("reports health", async () => {
    const response = await makeApp().inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string; service: string }>()).toEqual({
      status: "ok",
      service: "eazicart-api",
    });
  });

  it("registers without exposing a password or stored token", async () => {
    const response = await makeApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<AuthResponse>();
    expect(body.user).toEqual(
      expect.objectContaining({ email: "buyer@example.com" }),
    );
    expect(response.body).not.toContain("passwordHash");
  });

  it("passes only persistable fields to the auth store", async () => {
    const store = new MemoryAuthStore();
    const createUser = vi.spyOn(store, "createUser");
    const app = buildApp(config, { authStore: store });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    expect(response.statusCode).toBe(201);
    const input = createUser.mock.calls[0]?.[0];
    expect(Object.keys(input ?? {}).sort()).toEqual([
      "email",
      "name",
      "passwordHash",
    ]);
    expect(input?.passwordHash).toMatch(/^\$argon2/);
  });

  it("logs in registered users", async () => {
    const app = makeApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "buyer@example.com", password: "correct-horse" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<AuthResponse>();
    expect(body.tokens.accessToken).toBeTypeOf("string");
  });

  it("changes a password only after verifying the current password", async () => {
    const app = makeApp();
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    const registeredTokens = registered.json<AuthResponse>().tokens;
    const token = registeredTokens.accessToken;
    const incorrect = await app.inject({
      method: "POST",
      url: "/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        currentPassword: "wrong-password",
        newPassword: "new-correct-horse",
      },
    });
    expect(incorrect.statusCode).toBe(400);
    expect(incorrect.json<{ error: { code: string } }>().error.code).toBe(
      "INVALID_CURRENT_PASSWORD",
    );

    const changed = await app.inject({
      method: "POST",
      url: "/users/me/password",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        currentPassword: "correct-horse",
        newPassword: "new-correct-horse",
      },
    });
    expect(changed.statusCode).toBe(204);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: registeredTokens.refreshToken },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { email: "buyer@example.com", password: "correct-horse" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: {
            email: "buyer@example.com",
            password: "new-correct-horse",
          },
        })
      ).statusCode,
    ).toBe(200);
  });

  it("rejects duplicate emails after normalization", async () => {
    const app = makeApp();
    const payload = {
      email: "buyer@example.com",
      name: "Buyer",
      password: "correct-horse",
    };
    expect(
      (await app.inject({ method: "POST", url: "/auth/register", payload }))
        .statusCode,
    ).toBe(201);
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...payload, email: "BUYER@EXAMPLE.COM" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "EMAIL_IN_USE",
    );
  });

  it("rotates refresh tokens and prevents their reuse", async () => {
    const app = makeApp();
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    const refreshToken = registered.json<AuthResponse>().tokens.refreshToken;
    const rotated = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    expect(
      rotated.json<{ tokens: AuthTokensResponse }>().tokens.refreshToken,
    ).not.toBe(refreshToken);
    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reused.statusCode).toBe(401);
    expect(reused.json<{ error: { code: string } }>().error.code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
  });

  it("protects and authorizes the current-user route", async () => {
    const app = makeApp();
    expect(
      (await app.inject({ method: "GET", url: "/users/me" })).statusCode,
    ).toBe(401);
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    const token = registered.json<AuthResponse>().tokens.accessToken;
    const response = await app.inject({
      method: "GET",
      url: "/users/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<PublicUserResponse>().email).toBe("buyer@example.com");
  });

  it("handles published Reel interactions through the existing data models", async () => {
    const reelLikeUpsert = vi.fn().mockResolvedValue({});
    const reelSaveUpsert = vi.fn().mockResolvedValue({});
    const reelCommentCreate = vi.fn().mockResolvedValue({
      id: "comment-2",
      reelId: "reel-1",
      userId: "reels-buyer",
      body: "Nice reel",
      createdAt: new Date("2026-10-05T12:01:00.000Z"),
      updatedAt: new Date("2026-10-05T12:01:00.000Z"),
      user: { id: "reels-buyer", name: "Buyer" },
    });
    const reelViewCreate = vi.fn().mockResolvedValue({
      id: "view-1",
      watchMs: 1500,
      completed: true,
      createdAt: new Date("2026-10-05T12:02:00.000Z"),
    });
    const database = {
      reel: {
        findFirst: vi.fn().mockResolvedValue({ id: "reel-1" }),
      },
      reelLike: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: reelLikeUpsert,
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValueOnce(13).mockResolvedValueOnce(12),
      },
      reelSave: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: reelSaveUpsert,
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4),
      },
      reelComment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            reelId: "reel-1",
            userId: "existing-user",
            body: "First",
            createdAt: new Date("2026-10-05T12:00:00.000Z"),
            updatedAt: new Date("2026-10-05T12:00:00.000Z"),
            user: { id: "existing-user", name: "Existing User" },
          },
        ]),
        create: reelCommentCreate,
      },
      reelView: {
        create: reelViewCreate,
      },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "reels-buyer@example.com",
        name: "Buyer",
        password: "correct-horse",
      },
    });
    const auth = registered.json<AuthResponse>();
    const headers = { authorization: `Bearer ${auth.tokens.accessToken}` };

    const interactions = await app.inject({
      method: "GET",
      url: "/reels/reel-1/interactions",
      headers,
    });
    expect(interactions.statusCode).toBe(200);
    expect(interactions.json()).toEqual({
      data: { liked: false, saved: false },
    });

    const liked = await app.inject({
      method: "POST",
      url: "/reels/reel-1/like",
      headers,
    });
    expect(liked.statusCode).toBe(201);
    expect(liked.json()).toEqual({ data: { liked: true, count: 13 } });
    const unliked = await app.inject({
      method: "DELETE",
      url: "/reels/reel-1/like",
      headers,
    });
    expect(unliked.statusCode).toBe(200);
    expect(unliked.json()).toEqual({ data: { liked: false, count: 12 } });

    const saved = await app.inject({
      method: "POST",
      url: "/reels/reel-1/save",
      headers,
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toEqual({ data: { saved: true, count: 5 } });
    const unsaved = await app.inject({
      method: "DELETE",
      url: "/reels/reel-1/save",
      headers,
    });
    expect(unsaved.statusCode).toBe(200);
    expect(unsaved.json()).toEqual({ data: { saved: false, count: 4 } });

    const comments = await app.inject({
      method: "GET",
      url: "/reels/reel-1/comments",
    });
    expect(comments.statusCode).toBe(200);
    expect(
      comments.json<{ data: Array<{ body: string }> }>().data[0]?.body,
    ).toBe("First");
    const commented = await app.inject({
      method: "POST",
      url: "/reels/reel-1/comments",
      headers,
      payload: { body: "  Nice reel  " },
    });
    expect(commented.statusCode).toBe(201);
    expect(commented.json<{ data: { body: string } }>().data.body).toBe(
      "Nice reel",
    );

    const viewed = await app.inject({
      method: "POST",
      url: "/reels/reel-1/views",
      headers,
      payload: { watchMs: 1500, completed: true },
    });
    expect(viewed.statusCode).toBe(201);
    expect(viewed.json()).toEqual({
      data: {
        id: "view-1",
        watchMs: 1500,
        completed: true,
        createdAt: "2026-10-05T12:02:00.000Z",
      },
    });

    expect(reelLikeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: auth.user.id, reelId: "reel-1" },
      }),
    );
    expect(reelSaveUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: auth.user.id, reelId: "reel-1" },
      }),
    );
    expect(reelCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reelId: "reel-1",
          userId: auth.user.id,
          body: "Nice reel",
        },
      }),
    );
    expect(reelViewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reelId: "reel-1",
          userId: auth.user.id,
          watchMs: 1500,
          completed: true,
        },
      }),
    );
  });

  it("rejects every interaction route for Reels that are not published", async () => {
    const findPublishedReel = vi.fn().mockResolvedValue(null);
    const database = {
      reel: { findFirst: findPublishedReel },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "reels-guard@example.com",
        name: "Guard Tester",
        password: "correct-horse",
      },
    });
    const token = registered.json<AuthResponse>().tokens.accessToken;
    const authHeaders = { authorization: `Bearer ${token}` };
    const requests = [
      { method: "GET", url: "/reels/draft-reel/interactions", auth: true },
      { method: "POST", url: "/reels/draft-reel/like", auth: true },
      { method: "DELETE", url: "/reels/draft-reel/like", auth: true },
      { method: "POST", url: "/reels/draft-reel/save", auth: true },
      { method: "DELETE", url: "/reels/draft-reel/save", auth: true },
      { method: "GET", url: "/reels/draft-reel/comments", auth: false },
      {
        method: "POST",
        url: "/reels/draft-reel/comments",
        auth: true,
        payload: { body: "Blocked comment" },
      },
      {
        method: "POST",
        url: "/reels/draft-reel/views",
        auth: true,
        payload: { watchMs: 1500, completed: false },
      },
    ] as const;

    for (const request of requests) {
      const response = await app.inject({
        method: request.method,
        url: request.url,
        headers: request.auth ? authHeaders : undefined,
        payload: "payload" in request ? request.payload : undefined,
      });
      expect(response.statusCode, `${request.method} ${request.url}`).toBe(404);
      expect(
        response.json<{ error: { code: string } }>().error.code,
        `${request.method} ${request.url}`,
      ).toBe("REEL_NOT_FOUND");
    }

    expect(findPublishedReel).toHaveBeenCalledTimes(requests.length);
    expect(findPublishedReel).toHaveBeenCalledWith({
      where: { id: "draft-reel", status: "PUBLISHED" },
      select: { id: true },
    });
  });

  it.each([
    ["GET", "/cart"],
    ["GET", "/addresses"],
    ["GET", "/saved-products"],
    ["GET", "/following"],
    ["GET", "/orders"],
    ["GET", "/notifications"],
    ["POST", "/reels"],
    ["GET", "/reels/reel-1/interactions"],
    ["POST", "/reels/reel-1/like"],
    ["DELETE", "/reels/reel-1/like"],
    ["POST", "/reels/reel-1/save"],
    ["DELETE", "/reels/reel-1/save"],
    ["POST", "/reels/reel-1/comments"],
    ["POST", "/reels/reel-1/views"],
  ] as const)("rejects unauthenticated %s %s access", async (method, url) => {
    const response = await makeApp().inject({ method, url });
    expect(response.statusCode).toBe(401);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "UNAUTHORIZED",
    );
  });
});
