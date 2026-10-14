import { beforeEach, describe, expect, it, vi } from "vitest";
const { handleUpload, revalidateTag } = vi.hoisted(() => ({
  handleUpload: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@vercel/blob/client", () => ({ handleUpload }));
vi.mock("next/cache", () => ({ revalidateTag }));
import { POST } from "./route";
type UploadCallbacks = {
  onUploadCompleted: (payload: {
    blob: { pathname: string };
    tokenPayload: string;
  }) => Promise<void>;
};

describe("social upload metadata invalidation", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["profiles", "stories"])(
    "refreshes only the upload owner's %s metadata",
    async (folder) => {
      handleUpload.mockImplementationOnce(
        async ({ onUploadCompleted }: UploadCallbacks) => {
          await onUploadCompleted({
            blob: { pathname: `${folder}/seller-user/photo.png` },
            tokenPayload: JSON.stringify({ userId: "seller-user" }),
          });
          return {};
        },
      );
      const response = await POST(
        new Request("https://eazicart.test/api/social-images/upload", {
          method: "POST",
          body: "{}",
        }),
      );
      expect(response.status).toBe(200);
      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(
        "social-media:seller-user",
        { expire: 0 },
      );
    },
  );
  it("does not invalidate another account's cached media", async () => {
    handleUpload.mockImplementationOnce(
      async ({ onUploadCompleted }: UploadCallbacks) => {
        await onUploadCompleted({
          blob: { pathname: "profiles/other-user/photo.png" },
          tokenPayload: JSON.stringify({ userId: "seller-user" }),
        });
        return {};
      },
    );
    await POST(
      new Request("https://eazicart.test/api/social-images/upload", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
