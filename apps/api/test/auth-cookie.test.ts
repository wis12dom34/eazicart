import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
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
const makeApp = () => {
  const app = buildApp(config);
  apps.push(app);
  return app;
};
const cookieValue = (value: string | string[] | undefined) => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(";")[0];
};

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("refresh cookie sessions", () => {
  it("sets an HttpOnly SameSite refresh cookie on registration", async () => {
    const response = await makeApp().inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "cookie-buyer@example.com",
        name: "Cookie Buyer",
        password: "correct-horse",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["set-cookie"]).toContain("eazicart_refresh=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
  });

  it("rotates a cookie refresh token and revokes it on logout", async () => {
    const app = makeApp();
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "rotate-cookie@example.com",
        name: "Rotate Cookie",
        password: "correct-horse",
      },
    });
    const firstCookie = cookieValue(registered.headers["set-cookie"]);
    expect(firstCookie).toContain("eazicart_refresh=");

    const rotated = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: firstCookie ?? "" },
      payload: {},
    });
    expect(rotated.statusCode).toBe(200);
    const rotatedCookie = cookieValue(rotated.headers["set-cookie"]);
    expect(rotatedCookie).toContain("eazicart_refresh=");
    expect(rotatedCookie).not.toBe(firstCookie);

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: rotatedCookie ?? "" },
      payload: {},
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");

    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: rotatedCookie ?? "" },
      payload: {},
    });
    expect(reused.statusCode).toBe(401);
  });
});
