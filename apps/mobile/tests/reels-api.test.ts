import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});

function success(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("native Reels retrieves the existing paginated feed without auth for guests", async () => {
  const calls: Array<{ url: string; auth: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      auth: new Headers(init?.headers).get("Authorization"),
    });
    return success({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  };
  const feed = await api.reelsFeed("reels-cursor-1", false);
  assert.equal(feed.pagination.hasMore, false);
  assert.equal(calls.length, 1);
  assert.ok(
    calls[0]?.url.includes("/reels/feed?limit=8&cursor=reels-cursor-1"),
  );
  assert.equal(calls[0]?.auth, null);
});

test("Reel interactions require authentication before network request", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return success({});
  };
  await assert.rejects(
    api.reelInteractions("reel-1"),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(called, false);
});

test("Reel Like uses bearer token and POST; Unlike uses DELETE", async () => {
  setAccessToken("test-access");
  const calls: Array<{ method: string | undefined; auth: string | null }> = [];
  globalThis.fetch = async (_input, init) => {
    calls.push({
      method: init?.method,
      auth: new Headers(init?.headers).get("Authorization"),
    });
    return success({ data: { liked: init?.method === "POST", count: 4 } });
  };
  await api.reelLike("reel-1", false);
  await api.reelLike("reel-1", true);
  assert.deepEqual(
    calls.map((call) => call.method),
    ["POST", "DELETE"],
  );
  assert.deepEqual(
    calls.map((call) => call.auth),
    ["Bearer test-access", "Bearer test-access"],
  );
});

test("Reel view reuses supplied idempotency key and reports only measured watch time", async () => {
  setAccessToken("test-access");
  let body: unknown;
  globalThis.fetch = async (input, init) => {
    assert.ok(String(input).includes("/reels/reel-1/views"));
    assert.equal(init?.method, "POST");
    body = JSON.parse(String(init.body));
    return success({ data: { id: "view1" } });
  };
  await api.reelView(
    "reel-1",
    2400,
    false,
    "c05127f0-951c-486b-b0d1-df3420a1b938",
  );
  assert.deepEqual(body, {
    watchMs: 2400,
    completed: false,
    idempotencyKey: "c05127f0-951c-486b-b0d1-df3420a1b938",
  });
});

test("Reel comments use the read-only paginated endpoint", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "GET");
    assert.ok(
      String(input).includes("/reels/reel-1/comments?limit=20&cursor=older"),
    );
    return success({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  };
  assert.deepEqual((await api.reelComments("reel-1", "older")).data, []);
});
