import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload }));
vi.mock("./api/client", () => ({
  tokenStore: { get: () => ({ accessToken: "profile-test-token" }) },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: { setItem: vi.fn() },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("profile photo updates", () => {
  it("publishes an uploaded photo immediately and prevents an older read from restoring the previous photo", async () => {
    let finishRead!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finishRead = resolve;
          }),
      ),
    );
    upload.mockResolvedValue({ url: "https://blob.test/new.jpg" });
    const media = await import("./social-media");
    const changed = vi.fn();
    window.addEventListener(media.PROFILE_PHOTO_EVENT, changed);
    const staleRead = media.fetchProfilePhoto("profile-user");
    const photo = await media.uploadSocialMedia(
      "profile",
      "profile-user",
      new File(["photo"], "new.jpg", { type: "image/jpeg" }),
    );
    expect(changed).toHaveBeenCalledOnce();
    expect((changed.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      userId: "profile-user",
      photo,
    });
    finishRead(Response.json({ data: { url: "https://blob.test/old.jpg" } }));
    expect(await staleRead).toEqual(photo);
    expect(await media.fetchProfilePhoto("profile-user")).toEqual(photo);
  });

  it("clears the photo cache and broadcasts removal only after the authenticated delete succeeds", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: null }));
    vi.stubGlobal("fetch", fetch);
    upload.mockResolvedValue({ url: "https://blob.test/current.jpg" });
    const media = await import("./social-media");
    await media.uploadSocialMedia(
      "profile",
      "profile-user",
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
    );
    const changed = vi.fn();
    window.addEventListener(media.PROFILE_PHOTO_EVENT, changed);
    await media.removeProfilePhoto("profile-user");
    expect((changed.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      userId: "profile-user",
      photo: null,
    });
    expect(await media.fetchProfilePhoto("profile-user")).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the current photo when deletion is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "Session expired" }, { status: 401 }),
        ),
    );
    upload.mockResolvedValue({ url: "https://blob.test/current.jpg" });
    const media = await import("./social-media");
    const photo = await media.uploadSocialMedia(
      "profile",
      "profile-user",
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
    );
    const changed = vi.fn();
    window.addEventListener(media.PROFILE_PHOTO_EVENT, changed);
    await expect(media.removeProfilePhoto("profile-user")).rejects.toThrow(
      "Session expired",
    );
    expect(changed).not.toHaveBeenCalled();
    expect(await media.fetchProfilePhoto("profile-user")).toEqual(photo);
  });
});
