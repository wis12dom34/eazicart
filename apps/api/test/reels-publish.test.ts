import type { PrismaClient } from "@eazicart/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

interface AuthResponse {
  tokens: { accessToken: string };
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
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

async function register(app: ReturnType<typeof buildApp>, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, name: "Publisher", password: "correct-horse" },
  });
  return response.json<AuthResponse>().tokens.accessToken;
}

describe("Reel publishing", () => {
  it("requires a seller profile before publishing", async () => {
    const reelCreate = vi.fn();
    const database = {
      sellerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      reel: { create: reelCreate },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const token = await register(app, "reels-publisher-no-seller@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/reels",
      headers: { authorization: `Bearer ${token}` },
      payload: { videoUrl: "https://example.com/reel.mp4" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "SELLER_REQUIRED",
    );
    expect(reelCreate).not.toHaveBeenCalled();
  });

  it("rejects products the seller does not own or that are inactive", async () => {
    const productFindFirst = vi.fn().mockResolvedValue(null);
    const reelCreate = vi.fn();
    const database = {
      sellerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "seller-1" }),
      },
      product: { findFirst: productFindFirst },
      reel: { create: reelCreate },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const token = await register(
      app,
      "reels-publisher-product-guard@example.com",
    );

    const response = await app.inject({
      method: "POST",
      url: "/reels",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        videoUrl: "https://example.com/reel.mp4",
        productId: "product-foreign-or-inactive",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "PRODUCT_NOT_FOUND",
    );
    expect(productFindFirst).toHaveBeenCalledWith({
      where: {
        id: "product-foreign-or-inactive",
        sellerId: "seller-1",
        active: true,
      },
      select: { id: true },
    });
    expect(reelCreate).not.toHaveBeenCalled();
  });

  it("publishes normalized seller input without trusting server-owned fields", async () => {
    const reelCreate = vi.fn().mockResolvedValue({
      id: "reel-created",
      source: "EAZICART",
      status: "PUBLISHED",
      caption: "New drop",
      videoUrl: "https://example.com/reel.mp4",
      thumbnailUrl: "https://example.com/thumb.jpg",
      externalId: null,
      externalUrl: null,
      attribution: null,
      sellerId: "seller-1",
      productId: "product-1",
      publishedAt: new Date("2026-10-06T13:00:00.000Z"),
      createdAt: new Date("2026-10-06T13:00:00.000Z"),
      updatedAt: new Date("2026-10-06T13:00:00.000Z"),
      seller: null,
      product: null,
      _count: { likes: 0, saves: 0, views: 0, comments: 0 },
    });
    const database = {
      sellerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "seller-1" }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({ id: "product-1" }),
      },
      reel: { create: reelCreate },
    } as unknown as PrismaClient;
    const app = buildApp(config, { database });
    apps.push(app);
    const token = await register(app, "reels-publisher-valid@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/reels",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        caption: "  New drop  ",
        videoUrl: "https://example.com/reel.mp4",
        thumbnailUrl: "https://example.com/thumb.jpg",
        productId: "product-1",
        source: "PARTNER",
        status: "DRAFT",
        sellerId: "seller-attacker",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(reelCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          source: "EAZICART",
          status: "PUBLISHED",
          caption: "New drop",
          videoUrl: "https://example.com/reel.mp4",
          thumbnailUrl: "https://example.com/thumb.jpg",
          sellerId: "seller-1",
          productId: "product-1",
        },
      }),
    );
    expect(
      response.json<{ data: { id: string; caption: string } }>().data,
    ).toEqual(
      expect.objectContaining({ id: "reel-created", caption: "New drop" }),
    );
  });
});
