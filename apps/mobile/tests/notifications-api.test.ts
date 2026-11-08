import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { api, ApiError, setAccessToken, setRefreshHandler } from "../src/lib/api";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("signed-out account cannot fetch private notifications", async () => {
  let contacted = false;
  globalThis.fetch = async () => {
    contacted = true;
    return response({});
  };
  await assert.rejects(
    api.notifications(),
    (error: unknown) =>
      error instanceof ApiError && error.code === "LOGIN_REQUIRED",
  );
  assert.equal(contacted, false);
});

test("notifications use bearer auth and preserve unread count", async () => {
  setAccessToken("synthetic-user-token");
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).pathname, "/api/notifications");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-user-token",
    );
    return response({
      data: [
        {
          id: "notice-1",
          type: "ORDER",
          title: "Order update",
          body: "Your order is confirmed.",
          readAt: null,
          createdAt: "2026-11-08T11:00:00Z",
        },
      ],
      meta: { unreadCount: 1 },
    });
  };
  const data = await api.notifications();
  assert.equal(data.meta.unreadCount, 1);
  assert.equal(data.data[0]?.type, "ORDER");
});

test("mark-read PATCH encodes notification ID and preserves authentication", async () => {
  setAccessToken("synthetic-user-token");
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "PATCH");
    assert.equal(
      new URL(String(input)).pathname,
      "/api/notifications/notice%2Fprivate/read",
    );
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-user-token",
    );
    return response({ data: { id: "notice/private", readAt: "2026-11-08T11:01:00Z" } });
  };
  const data = await api.notificationRead("notice/private");
  assert.equal(data.data.id, "notice/private");
});

test("mark-all PATCH uses the existing read-all endpoint", async () => {
  setAccessToken("synthetic-user-token");
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "PATCH");
    assert.equal(
      new URL(String(input)).pathname,
      "/api/notifications/read-all",
    );
    return response({ data: { updated: 3 } });
  };
  assert.equal((await api.notificationsReadAll()).data.updated, 3);
});

test("signed-out account cannot mark notifications read or read-all", async () => {
  let contacted = false;
  globalThis.fetch = async () => {
    contacted = true;
    return response({});
  };
  await assert.rejects(api.notificationRead("id"), ApiError);
  await assert.rejects(api.notificationsReadAll(), ApiError);
  assert.equal(contacted, false);
});
