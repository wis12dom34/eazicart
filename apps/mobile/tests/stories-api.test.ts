import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { api, setAccessToken, setRefreshHandler } from "../src/lib/api";

const oldFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = oldFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const ok = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

test("native Stories previews use the existing public batch endpoint, limited to 12", async () => {
  let requested = "";
  globalThis.fetch = async (input, init) => {
    requested = String(input);
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return ok({ data: {} });
  };
  const ids = Array.from({ length: 15 }, (_, i) => "user-abc-" + i);
  await api.storyPreviews(ids);
  assert.equal(new URL(requested).pathname, "/api/social/stories");
  assert.equal(
    new URL(requested).searchParams.get("userIds")?.split(",").length,
    12,
  );
});
test("native Stories viewer loads real seller story list without credentials", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new URL(String(input)).pathname,
      "/api/social/stories/seller-1",
    );
    assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return ok({
      data: [
        {
          id: "story1",
          url: "https://example.com/1.jpg",
          uploadedAt: "2026-11-05T13:00:00Z",
          contentType: "image/jpeg",
        },
      ],
    });
  };
  const result = await api.storiesForUser("seller-1");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.id, "story1");
});
