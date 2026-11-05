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
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("loads cursor-paginated real API contract without any authorization header", async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
  };
  const result = await api.feed("cursor-page-2", false);
  assert.deepEqual(result.data, []);
  assert.ok(
    requests[0]?.url.includes(
      "/api/feed/products?limit=18&cursor=cursor-page-2",
    ),
  );
  assert.equal(requests[0]?.headers.has("Authorization"), false);
});

test("uses the existing EaziCart login contract", async () => {
  let body: unknown;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    body = JSON.parse(String(init?.body));
    return json({
      user: { id: "user1", name: "Test", email: "test@example.com" },
      tokens: {
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01",
      },
    });
  };
  const response = await api.login("test@example.com", "password123");
  assert.deepEqual(body, {
    email: "test@example.com",
    password: "password123",
  });
  assert.equal(response.user.id, "user1");
});

test("does not issue a protected Like when signed out", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return json({});
  };
  await assert.rejects(
    api.like("product1"),
    (e: unknown) =>
      e instanceof ApiError && e.status === 401 && e.code === "LOGIN_REQUIRED",
  );
  assert.equal(called, false);
});

test("refreshes the bearer token once and retries a protected request", async () => {
  const headers: string[] = [];
  setAccessToken("expired");
  setRefreshHandler(async () => {
    setAccessToken("renewed");
    return true;
  });
  globalThis.fetch = async (_input, init) => {
    const token = new Headers(init?.headers).get("Authorization");
    headers.push(String(token));
    return token === "Bearer expired"
      ? json({ error: { code: "UNAUTHORIZED", message: "Expired" } }, 401)
      : json({ data: { likes: 1, comments: 0, liked: true } });
  };
  const result = await api.like("product1");
  assert.deepEqual(headers, ["Bearer expired", "Bearer renewed"]);
  assert.equal(result.data.liked, true);
});

test("displays upstream validation errors without leaking secret data", async () => {
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect credentials",
        },
      },
      401,
    );
  await assert.rejects(
    api.login("test@example.com", "badpass"),
    (e: unknown) =>
      e instanceof ApiError &&
      e.code === "INVALID_CREDENTIALS" &&
      e.message === "Incorrect credentials",
  );
});
