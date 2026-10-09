import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@eazicart/database";
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
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("deployment readiness", () => {
  it("fails closed when production dependencies are missing", () => {
    expect(() => buildApp({ ...config, NODE_ENV: "production" })).toThrow(
      "Production requires a database and persistent auth store",
    );
  });

  it.each(["missing", "offline", "connected"])(
    "reports readiness for a %s database without exposing connection details",
    async (state) => {
      const query = vi.fn();
      if (state === "offline")
        query.mockRejectedValue(new Error("private-database-connection"));
      else query.mockResolvedValue([{ result: 1 }]);
      const app = buildApp(config, {
        database:
          state === "missing"
            ? undefined
            : ({ $queryRaw: query } as unknown as PrismaClient),
      });
      apps.push(app);
      const response = await app.inject({ method: "GET", url: "/ready" });
      expect(response.statusCode).toBe(state === "connected" ? 200 : 503);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).not.toContain("private-database-connection");
      expect(response.json<{ status: string }>().status).toBe(
        state === "connected" ? "ready" : "unavailable",
      );
      expect(
        (await app.inject({ method: "GET", url: "/health" })).statusCode,
      ).toBe(200);
    },
  );
});
