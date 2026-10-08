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

type ReelFindManyQuery = {
  where?: { status?: string; sellerId?: string };
  take?: number;
};

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("Reel feed seller scope", () => {
  it("filters the database query by seller without loading unrelated reels", async () => {
    let receivedQuery: ReelFindManyQuery | undefined;
    const findMany = vi.fn((query: ReelFindManyQuery) => {
      receivedQuery = query;
      return Promise.resolve([]);
    });
    const database = { reel: { findMany } } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/reels/feed?sellerId=seller-123&limit=20",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(receivedQuery?.where?.status).toBe("PUBLISHED");
    expect(receivedQuery?.where?.sellerId).toBe("seller-123");
    expect(receivedQuery?.take).toBe(21);
  });
});
