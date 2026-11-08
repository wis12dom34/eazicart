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
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("signed-out users cannot list, start or send messages", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return json({});
  };
  await assert.rejects(
    api.conversations(),
    (error: unknown) =>
      error instanceof ApiError && error.code === "LOGIN_REQUIRED",
  );
  await assert.rejects(api.startConversation("seller-id"), ApiError);
  await assert.rejects(api.conversationMessages("chat-id"), ApiError);
  await assert.rejects(
    api.sendChatMessage(
      "chat-id",
      "Test",
      "f337bf8f-94cf-4d59-8148-60b8b280fb04",
    ),
    ApiError,
  );
  assert.equal(calls, 0);
});

test("conversation listing, start and paging use authenticated routes", async () => {
  setAccessToken("synthetic-test-token");
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    seen.push(method + " " + url.pathname + url.search);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-test-token",
    );
    if (url.pathname === "/api/conversations" && method === "POST") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        sellerUserId: "seller-42",
      });
      return json({ data: { id: "conversation-7" } });
    }
    if (url.pathname.endsWith("/messages"))
      return json({
        data: [],
        pagination: { hasMore: false, nextCursor: null },
      });
    return json({ data: [] });
  };
  await api.conversations();
  const result = await api.startConversation("seller-42");
  await api.conversationMessages("conversation-7", "older-message");
  assert.equal(result.data.id, "conversation-7");
  assert.deepEqual(seen, [
    "GET /api/conversations",
    "POST /api/conversations",
    "GET /api/conversations/conversation-7/messages?cursor=older-message",
  ]);
});

test("sending a message includes stable client UUID, body and bearer token", async () => {
  setAccessToken("synthetic-test-token");
  const uuid = "f337bf8f-94cf-4d59-8148-60b8b280fb04";
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(
      new URL(String(input)).pathname,
      "/api/conversations/conversation-7/messages",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      body: "Hello seller",
      clientMessageId: uuid,
    });
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-test-token",
    );
    return json({
      data: {
        id: "message-1",
        conversationId: "conversation-7",
        senderId: "buyer-1",
        body: "Hello seller",
        clientMessageId: uuid,
        createdAt: "2026-11-08T12:00:00.000Z",
      },
    });
  };
  const message = await api.sendChatMessage(
    "conversation-7",
    "Hello seller",
    uuid,
  );
  assert.equal(message.data.id, "message-1");
});
