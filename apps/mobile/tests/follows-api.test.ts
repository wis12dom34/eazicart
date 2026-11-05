import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";

const previousFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = previousFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("following list is not requested without an authenticated account", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return ok({});
  };
  await assert.rejects(
    api.following(),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(called, false);
});
test("following list uses bearer auth and preserves seller user IDs", async () => {
  setAccessToken("test-token");
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).pathname, "/api/following");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-token",
    );
    return ok({
      data: [
        {
          followerId: "buyer-1",
          sellerId: "seller-user-42",
          seller: {
            id: "seller-user-42",
            name: "Shop",
            sellerProfile: {
              id: "profile-42",
              userId: "seller-user-42",
              displayName: "The Shop",
            },
          },
        },
      ],
    });
  };
  const response = await api.following();
  assert.equal(response.data[0]?.sellerId, "seller-user-42");
  assert.equal(response.data[0]?.seller.sellerProfile?.id, "profile-42");
});
test("Follow and Unfollow send the seller user ID, not the profile ID", async () => {
  setAccessToken("test-token");
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : ok({ data: {} }, 201);
  };
  await api.followSeller("seller-user-42");
  await api.unfollowSeller("seller-user-42");
  assert.deepEqual(requests, [
    "POST /api/sellers/seller-user-42/follow",
    "DELETE /api/sellers/seller-user-42/follow",
  ]);
});
test("public follower count needs no user token", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new URL(String(input)).pathname,
      "/api/sellers/seller-user-42/followers/count",
    );
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return ok({ data: { count: 3 } });
  };
  assert.equal((await api.followerCount("seller-user-42")).data.count, 3);
});
test("unauthorized follow is blocked locally and production API is never contacted", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return ok({});
  };
  await assert.rejects(
    api.followSeller("seller-user-42"),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(called, false);
});
