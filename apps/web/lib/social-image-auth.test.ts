import type { HandleUploadOptions } from "@vercel/blob/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, del, handleUpload } = vi.hoisted(() => ({
  list: vi.fn(),
  del: vi.fn(),
  handleUpload: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({ list, del }));
vi.mock("@vercel/blob/client", () => ({ handleUpload }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://api.example.test/");
});
const request = (body: unknown) =>
  new Request("https://web.example.test/api/social-images/profile", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("user-scoped social-image authentication", () => {
  it("checks removal ownership against the configured API before accessing Blob", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "another-user" }));
    vi.stubGlobal("fetch", fetch);
    const { DELETE } = await import("../app/api/social-images/profile/route");
    expect(
      (
        await DELETE(
          request({ userId: "profile-user", accessToken: "test-token" }),
        )
      ).status,
    ).toBe(403);
    expect(list).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/users/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
        cache: "no-store",
      }),
    );
  });

  it("removes all pages of only the authenticated user's profile photos", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(Response.json({ id: "profile-user" })),
        ),
    );
    list
      .mockResolvedValueOnce({
        blobs: [{ url: "https://blob.test/old.jpg" }],
        hasMore: true,
        cursor: "next",
      })
      .mockResolvedValueOnce({
        blobs: [{ url: "https://blob.test/new.jpg" }],
        hasMore: false,
      });
    const { DELETE } = await import("../app/api/social-images/profile/route");
    expect(
      (
        await DELETE(
          request({ userId: "profile-user", accessToken: "test-token" }),
        )
      ).status,
    ).toBe(200);
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: "profiles/profile-user/",
      limit: 1000,
      cursor: "next",
    });
    expect(del).toHaveBeenCalledWith([
      "https://blob.test/old.jpg",
      "https://blob.test/new.jpg",
    ]);
  });

  it("fails closed for missing configuration or expired authentication", async () => {
    vi.stubEnv("EAZICART_PUBLIC_API_URL", "");
    const { DELETE } = await import("../app/api/social-images/profile/route");
    expect(
      (
        await DELETE(
          request({ userId: "profile-user", accessToken: "test-token" }),
        )
      ).status,
    ).toBe(400);
    expect(list).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const route = await import("../app/api/social-images/profile/route");
    expect(
      (
        await route.DELETE(
          request({ userId: "profile-user", accessToken: "expired" }),
        )
      ).status,
    ).toBe(401);
    expect(del).not.toHaveBeenCalled();
  });

  it("issues upload tokens only for the API-authenticated user's own path", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(Response.json({ id: "profile-user" })),
        ),
    );
    handleUpload.mockImplementation(
      async ({ onBeforeGenerateToken }: HandleUploadOptions) => {
        await expect(
          onBeforeGenerateToken(
            "profiles/another-user/photo.jpg",
            JSON.stringify({ accessToken: "test-token" }),
            false,
          ),
        ).rejects.toThrow("Invalid social media path");
        const token = await onBeforeGenerateToken(
          "profiles/profile-user/photo.jpg",
          JSON.stringify({ accessToken: "test-token" }),
          false,
        );
        expect(token.maximumSizeInBytes).toBe(8 * 1024 * 1024);
        expect(token.allowedContentTypes).not.toContain("video/mp4");
        const story = await onBeforeGenerateToken(
          "stories/profile-user/story.mp4",
          JSON.stringify({ accessToken: "test-token" }),
          false,
        );
        expect(story.maximumSizeInBytes).toBe(50 * 1024 * 1024);
        return { ok: true };
      },
    );
    const { POST } = await import("../app/api/social-images/upload/route");
    const result = await POST(
      new Request("https://web.example.test/api/social-images/upload", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(result.status).toBe(200);
    expect(handleUpload).toHaveBeenCalledOnce();
  });
});
