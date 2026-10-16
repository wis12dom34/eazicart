import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list }));
import { listActiveStories } from "./story-storage";
import { GET } from "../app/api/social-images/stories/route";

const now = new Date("2026-10-16T12:00:00Z");
const blob = (name: string, uploadedAt: string) => ({
  url: `https://store.public.blob.vercel-storage.com/${name}`,
  pathname: `stories/seller-user/${name}`,
  uploadedAt: new Date(uploadedAt),
});

beforeEach(() => {
  list.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("active story storage", () => {
  it("reads later pages and returns only active stories in playback order", async () => {
    const older = blob("older.jpg", "2026-10-15T13:00:00Z");
    const latest = blob("latest.mp4", "2026-10-16T11:00:00Z");
    list
      .mockResolvedValueOnce({
        blobs: [blob("expired.jpg", "2026-10-15T11:59:59Z"), latest],
        hasMore: true,
        cursor: "second-page",
      })
      .mockResolvedValueOnce({
        blobs: [older, blob("future.jpg", "2026-10-17T12:00:00Z")],
        hasMore: false,
      });
    expect(await listActiveStories("seller-user")).toEqual([older, latest]);
    expect(list).toHaveBeenLastCalledWith({
      prefix: "stories/seller-user/",
      limit: 1000,
      cursor: "second-page",
      abortSignal: expect.any(AbortSignal) as unknown,
    });
  });

  it("uses later pages for the rail preview, including media type", async () => {
    list
      .mockResolvedValueOnce({
        blobs: [blob("expired.jpg", "2026-10-14T12:00:00Z")],
        hasMore: true,
        cursor: "more",
      })
      .mockResolvedValueOnce({
        blobs: [blob("latest.mp4", "2026-10-16T11:00:00Z")],
        hasMore: false,
      });
    const response = await GET(
      new Request(
        "https://eazicart.test/api/social-images/stories?userIds=seller-user",
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        "seller-user": {
          url: "https://store.public.blob.vercel-storage.com/latest.mp4",
          uploadedAt: "2026-10-16T11:00:00.000Z",
          contentType: "video/mp4",
        },
      },
    });
  });

  it("rejects invalid IDs, deduplicates IDs and caps batch size", async () => {
    list.mockResolvedValue({ blobs: [], hasMore: false });
    const ids = [
      "../invalid",
      "short",
      "seller-user",
      "seller-user",
      ...Array.from({ length: 20 }, (_, i) => `seller-user-${i}`),
    ];
    const response = await GET(
      new Request(
        `https://eazicart.test/api/social-images/stories?userIds=${encodeURIComponent(ids.join(","))}`,
      ),
    );
    expect(await response.json()).toEqual({ data: {} });
    expect(list).toHaveBeenCalledTimes(12);
    expect(
      list.mock.calls.filter(
        ([options]) =>
          (options as { prefix: string }).prefix === "stories/seller-user/",
      ),
    ).toHaveLength(1);
  });

  it("returns an explicit unavailable response rather than a false empty success", async () => {
    list.mockRejectedValue(new Error("private upstream detail"));
    const response = await GET(
      new Request(
        "https://eazicart.test/api/social-images/stories?userIds=seller-user",
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Stories are temporarily unavailable.",
    });
  });
});
