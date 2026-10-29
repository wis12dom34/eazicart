import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
import { fetchStories } from "./social-media";

afterEach(() => vi.unstubAllGlobals());

describe("optional Home stories request", () => {
  it("does not request storage for an empty rail", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await fetchStories([])).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    () => Promise.reject(new Error("offline")),
    () => Promise.reject(new DOMException("Timed out", "TimeoutError")),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.resolve(new Response("invalid JSON")),
  ])(
    "does not leave Home with an unhandled rejection on failed reads",
    async (failure) => {
      vi.stubGlobal("fetch", vi.fn(failure));
      await expect(fetchStories(["seller-user"])).resolves.toEqual({});
    },
  );

  it("preserves real metadata and bounds the request", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          "seller-user": {
            url: "/story.mp4",
            uploadedAt: "2026-10-16T12:00:00Z",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchStories(["seller-user"])).toEqual({
      "seller-user": {
        url: "/story.mp4",
        uploadedAt: "2026-10-16T12:00:00Z",
        contentType: "video/mp4",
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/social-images/stories?userIds=seller-user",
      { cache: "no-store", signal: expect.any(AbortSignal) as unknown },
    );
  });
});
