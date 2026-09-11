import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

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
});
