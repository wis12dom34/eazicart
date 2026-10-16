import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload }));
vi.mock("./api/client", () => ({
  tokenStore: { get: () => ({ accessToken: "test-only" }) },
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  upload.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const photo = (url: string) => ({ url, uploadedAt: "2026-10-13T12:00:00Z" });
const response = (url: string) => Response.json({ data: photo(url) });

describe("shared account profile photo", () => {
  it("deduplicates concurrent avatar reads and refreshes expired photos", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response("/first.jpg"))
      .mockResolvedValueOnce(response("/latest.jpg"));
    vi.stubGlobal("fetch", fetch);
    const { fetchProfilePhoto } = await import("./social-media");
    const result = await Promise.all([
      fetchProfilePhoto("seller-user"),
      fetchProfilePhoto("seller-user"),
    ]);
    expect(result.map((p) => p?.url)).toEqual(["/first.jpg", "/first.jpg"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_001);
    expect((await fetchProfilePhoto("seller-user"))?.url).toBe("/latest.jpg");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed first read as a missing photo", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(response("/latest.jpg"));
    vi.stubGlobal("fetch", fetch);
    const { fetchProfilePhoto } = await import("./social-media");
    expect(await fetchProfilePhoto("seller-user")).toBeNull();
    expect((await fetchProfilePhoto("seller-user"))?.url).toBe("/latest.jpg");
  });

  it("keeps the last known photo during a transient refresh failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response("/first.jpg"))
        .mockRejectedValueOnce(new Error("offline")),
    );
    const { fetchProfilePhoto } = await import("./social-media");
    await fetchProfilePhoto("seller-user");
    vi.advanceTimersByTime(30_001);
    expect((await fetchProfilePhoto("seller-user"))?.url).toBe("/first.jpg");
  });

  it("keeps a completed upload when an older avatar read finishes later", async () => {
    let resolveRead!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveRead = resolve;
          }),
      ),
    );
    upload.mockResolvedValue({ url: "/uploaded.jpg" });
    const window = new EventTarget();
    const storage = { setItem: vi.fn() };
    Object.assign(window, { localStorage: storage });
    vi.stubGlobal("window", window);
    const media = await import("./social-media");
    const updates = vi.fn();
    window.addEventListener(media.PROFILE_PHOTO_EVENT, updates);
    const read = media.fetchProfilePhoto("seller-user");
    await media.uploadSocialMedia(
      "profile",
      "seller-user",
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
    );
    resolveRead(response("/old.jpg"));
    expect((await read)?.url).toBe("/uploaded.jpg");
    expect((await media.fetchProfilePhoto("seller-user"))?.url).toBe(
      "/uploaded.jpg",
    );
    expect(updates).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      media.PROFILE_PHOTO_STORAGE_KEY,
      expect.stringContaining('"userId":"seller-user"'),
    );
  });

  it("supersedes a pending read when another tab changes the photo", async () => {
    let finishOldRead!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOldRead = resolve;
          }),
      )
      .mockResolvedValueOnce(response("/latest.jpg"));
    vi.stubGlobal("fetch", fetch);
    const { fetchProfilePhoto, invalidateProfilePhoto } =
      await import("./social-media");
    const first = fetchProfilePhoto("seller-user");
    invalidateProfilePhoto("seller-user");
    const second = fetchProfilePhoto("seller-user");
    finishOldRead(response("/old.jpg"));
    expect((await first)?.url).toBe("/latest.jpg");
    expect((await second)?.url).toBe("/latest.jpg");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not restore a photo removed in another tab", async () => {
    let finishOldRead!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOldRead = resolve;
          }),
      )
      .mockResolvedValueOnce(Response.json({ data: null }));
    vi.stubGlobal("fetch", fetch);
    const media = await import("./social-media");
    const oldRead = media.fetchProfilePhoto("seller-user");
    media.invalidateProfilePhoto("seller-user");
    expect(await media.fetchProfilePhoto("seller-user")).toBeNull();
    finishOldRead(response("/removed.jpg"));
    expect(await oldRead).toBeNull();
    expect(await media.fetchProfilePhoto("seller-user")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("discards the superseded read even when the fresh read fails", async () => {
    let finishOldRead!: (value: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOldRead = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const media = await import("./social-media");
    const oldRead = media.fetchProfilePhoto("seller-user");
    media.invalidateProfilePhoto("seller-user");
    expect(await media.fetchProfilePhoto("seller-user")).toBeNull();
    finishOldRead(response("/stale.jpg"));
    expect(await oldRead).toBeNull();
  });

  it("retains the last completed photo if an invalidated refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response("/known.jpg"))
        .mockRejectedValueOnce(new Error("offline")),
    );
    const media = await import("./social-media");
    await media.fetchProfilePhoto("seller-user");
    media.invalidateProfilePhoto("seller-user");
    expect((await media.fetchProfilePhoto("seller-user"))?.url).toBe(
      "/known.jpg",
    );
  });
});
