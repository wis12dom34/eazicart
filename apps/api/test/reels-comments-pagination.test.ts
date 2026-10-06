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

const comment = (id: string, createdAt: string) => ({
  id,
  reelId: "reel-comments-page",
  userId: "user-1",
  body: id,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
  user: { id: "user-1", name: "Commenter" },
});

describe("Reel comment pagination", () => {
  it("returns the latest page chronologically and pages toward older comments", async () => {
    const newest = comment("comment-3", "2026-10-06T13:03:00.000Z");
    const middle = comment("comment-2", "2026-10-06T13:02:00.000Z");
    const oldest = comment("comment-1", "2026-10-06T13:01:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([newest, middle, oldest])
      .mockResolvedValueOnce([oldest]);
    const database = {
      reel: {
        findFirst: vi.fn().mockResolvedValue({ id: "reel-comments-page" }),
      },
      reelComment: { findMany },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);

    const first = await app.inject({
      method: "GET",
      url: "/reels/reel-comments-page/comments?limit=2",
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json<{
      data: { id: string }[];
      pagination: { nextCursor: string | null; hasMore: boolean };
    }>();
    expect(firstBody.data.map(({ id }) => id)).toEqual([
      "comment-2",
      "comment-3",
    ]);
    expect(firstBody.pagination.hasMore).toBe(true);
    expect(firstBody.pagination.nextCursor).toBeTypeOf("string");
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { reelId: "reel-comments-page", OR: undefined },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
    });

    expect(
      Buffer.from(firstBody.pagination.nextCursor!, "base64url").toString(
        "utf8",
      ),
    ).toBe(
      JSON.stringify({
        createdAt: "2026-10-06T13:02:00.000Z",
        id: "comment-2",
      }),
    );

    const second = await app.inject({
      method: "GET",
      url: `/reels/reel-comments-page/comments?limit=2&cursor=${encodeURIComponent(firstBody.pagination.nextCursor!)}`,
    });

    expect(second.statusCode).toBe(200);
    expect(
      second.json<{
        data: { id: string }[];
        pagination: { nextCursor: string | null; hasMore: boolean };
      }>(),
    ).toEqual({
      data: [expect.objectContaining({ id: "comment-1" })],
      pagination: { nextCursor: null, hasMore: false },
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        reelId: "reel-comments-page",
        OR: [
          { createdAt: { lt: new Date("2026-10-06T13:02:00.000Z") } },
          {
            createdAt: new Date("2026-10-06T13:02:00.000Z"),
            id: { lt: "comment-2" },
          },
        ],
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
    });
  });

  it("rejects malformed comment cursors before querying comments", async () => {
    const findMany = vi.fn();
    const database = {
      reel: { findFirst: vi.fn() },
      reelComment: { findMany },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "2026-10-06T13:02:00.000Z", id: 123 }),
      "utf8",
    ).toString("base64url");

    const response = await app.inject({
      method: "GET",
      url: `/reels/reel-comments-page/comments?cursor=${encodeURIComponent(cursor)}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "INVALID_CURSOR",
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
