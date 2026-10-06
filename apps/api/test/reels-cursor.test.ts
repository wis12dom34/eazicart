import type { PrismaClient } from "@eazicart/database";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Reel feed cursor validation", () => {
  it("rejects typed-but-invalid cursors before querying the database", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const database = { reel: { findMany } } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const invalidCursors = [
      { publishedAt: "2026-10-06T12:02:00.000Z", id: 123 },
      { publishedAt: 123, id: "reel-2" },
    ];

    for (const value of invalidCursors) {
      const cursor = Buffer.from(JSON.stringify(value), "utf8").toString(
        "base64url",
      );
      const response = await app.inject({
        method: "GET",
        url: `/reels/feed?cursor=${encodeURIComponent(cursor)}`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        "INVALID_CURSOR",
      );
    }

    expect(findMany).not.toHaveBeenCalled();
  });
});
