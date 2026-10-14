import { describe, expect, it, vi } from "vitest";
const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list }));
vi.mock("next/cache", () => ({
  unstable_cache: (callback: (...args: unknown[]) => unknown) => callback,
}));
import { GET } from "./route";

describe("existing profile photo endpoint", () => {
  it("selects the latest account photo across Blob listing pages", async () => {
    list.mockResolvedValueOnce({
      blobs: [{ url: "/old.jpg", uploadedAt: new Date("2026-10-01") }],
      hasMore: true,
      cursor: "next-page",
    });
    list.mockResolvedValueOnce({
      blobs: [{ url: "/latest.jpg", uploadedAt: new Date("2026-10-13") }],
      hasMore: false,
    });
    const result = await GET(
      new Request(
        "https://eazicart.test/api/social-images/profile?userId=seller-user",
      ),
    );
    expect(await result.json()).toEqual({
      data: { url: "/latest.jpg", uploadedAt: "2026-10-13T00:00:00.000Z" },
    });
    expect(list).toHaveBeenLastCalledWith({
      prefix: "profiles/seller-user/",
      limit: 1000,
      cursor: "next-page",
    });
  });
});
