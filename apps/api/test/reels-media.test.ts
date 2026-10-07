import type { PrismaClient } from "@eazicart/database";
import { mkdtemp, readdir, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
});
const video = Buffer.from([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
]);
async function setup(seller = true, enabled = true) {
  const directory = await mkdtemp(join(tmpdir(), "eazicart-media-"));
  folders.push(directory);
  let published = false;
  const database = {
    sellerProfile: {
      findUnique: vi.fn().mockResolvedValue(seller ? { id: "seller-1" } : null),
    },
    reel: {
      findFirst: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(published ? { id: "reel-1" } : null),
        ),
    },
  } as unknown as PrismaClient;
  const app = buildApp(
    {
      ...config,
      ...(enabled
        ? {
            REEL_MEDIA_DIRECTORY: directory,
            REEL_MEDIA_BASE_URL: "https://media.example.com",
          }
        : {}),
    },
    { database },
  );
  apps.push(app);
  const registration = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "media@example.com",
      name: "Seller",
      password: "correct-horse",
    },
  });
  const headers = {
    authorization: `Bearer ${registration.json<{ tokens: { accessToken: string } }>().tokens.accessToken}`,
    "content-type": "video/mp4",
    "x-request-id": "same-client-id",
  };
  return {
    app,
    directory,
    headers,
    publish: () => {
      published = true;
    },
  };
}
describe("Reel video uploads", () => {
  it("requires authentication and a seller profile before accepting media", async () => {
    const { app, headers, directory } = await setup(false);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers: { "content-type": "video/mp4" },
          payload: video,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: video,
        })
      ).statusCode,
    ).toBe(403);
    expect(await readdir(directory)).toEqual([]);
  });
  it("reports missing storage configuration without writing files", async () => {
    const { app, headers, directory } = await setup(true, false);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: video,
        })
      ).statusCode,
    ).toBe(503);
    expect(await readdir(directory)).toEqual([]);
  });
  it("rejects spoofed files, unsupported types and oversize bodies with actionable errors", async () => {
    const { app, headers, directory } = await setup();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: Buffer.from("not-a-real-video-file"),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers: { ...headers, "content-type": "image/png" },
          payload: video,
        })
      ).statusCode,
    ).toBe(415);
    const large = await app.inject({
      method: "POST",
      url: "/seller/reels/media",
      headers: { ...headers, "content-length": String(50 * 1024 * 1024 + 1) },
      payload: video,
    });
    expect(large.statusCode).toBe(413);
    expect(large.json<{ error: { code: string } }>().error.code).toBe(
      "VIDEO_TOO_LARGE",
    );
    expect(await readdir(directory)).toEqual([]);
  });
  it("stores randomized media and serves published videos with full, partial and suffix ranges", async () => {
    const { app, headers, directory, publish } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/seller/reels/media",
      headers,
      payload: video,
    });
    expect(response.statusCode).toBe(201);
    const url = new URL(
      response.json<{ data: { videoUrl: string } }>().data.videoUrl,
    );
    expect(url.hostname).toBe("media.example.com");
    expect(await readdir(directory)).toHaveLength(1);
    expect((await app.inject({ url: url.pathname })).statusCode).toBe(404);
    publish();
    const full = await app.inject({ url: url.pathname });
    expect(full.rawPayload).toEqual(video);
    expect(full.headers["content-type"]).toBe("video/mp4");
    const range = await app.inject({
      url: url.pathname,
      headers: { range: "bytes=4-7" },
    });
    expect(range.statusCode).toBe(206);
    expect(range.rawPayload).toEqual(video.subarray(4, 8));
    expect(range.headers["content-range"]).toBe(`bytes 4-7/${video.length}`);
    const suffix = await app.inject({
      url: url.pathname,
      headers: { range: "bytes=-4" },
    });
    expect(suffix.rawPayload).toEqual(video.subarray(-4));
    expect(
      (
        await app.inject({
          url: url.pathname,
          headers: { range: "bytes=99-100" },
        })
      ).statusCode,
    ).toBe(416);
    expect(
      (await app.inject({ url: "/reels/media/not-a-file.mp4" })).statusCode,
    ).toBe(404);
  });
  it("limits upload attempts and releases capacity even when request IDs are reused", async () => {
    const { app, headers } = await setup();
    for (let i = 0; i < 5; i++)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/seller/reels/media",
            headers,
            payload: video,
          })
        ).statusCode,
      ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: video,
        })
      ).statusCode,
    ).toBe(429);
  });
  it("cleans abandoned uploads without removing a referenced Reel video", async () => {
    const { app, headers, directory, publish } = await setup();
    const name = "12345678-1234-1234-1234-123456789012.mp4";
    const file = join(directory, name);
    await writeFile(file, video);
    await utimes(file, new Date(0), new Date(0));
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: video,
        })
      ).statusCode,
    ).toBe(201);
    expect(await readdir(directory)).not.toContain(name);
    await writeFile(file, video);
    await utimes(file, new Date(0), new Date(0));
    publish();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/seller/reels/media",
          headers,
          payload: video,
        })
      ).statusCode,
    ).toBe(201);
    expect(await readdir(directory)).toContain(name);
  });
});
