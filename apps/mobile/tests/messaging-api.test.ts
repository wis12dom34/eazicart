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

test("product sharing and read acknowledgement preserve authentication and paths", async () => {
  setAccessToken("synthetic-test-token");
  const uuid = "f337bf8f-94cf-4d59-8148-60b8b280fb04";
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    seen.push(`${init?.method} ${url.pathname}`);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-test-token",
    );
    if (init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        body: "",
        clientMessageId: uuid,
        productId: "product-1",
      });
      return json({ data: { id: "message-2" } });
    }
    return json({ data: { read: true } });
  };
  await api.sendChatMessage("chat/1", "", uuid, "product-1");
  const acknowledged = await api.conversationRead("chat/1");
  assert.equal(acknowledged.data.read, true);
  assert.deepEqual(seen, [
    "POST /api/conversations/chat%2F1/messages",
    "PATCH /api/conversations/chat%2F1/read",
  ]);
});

test("a signed-out user cannot mark messages read", async () => {
  let touched = false;
  globalThis.fetch = async () => {
    touched = true;
    return json({});
  };
  await assert.rejects(api.conversationRead("chat-id"), ApiError);
  assert.equal(touched, false);
});

test("a network failure can retry a message with exactly the same client ID", async () => {
  setAccessToken("synthetic-test-token");
  const key = "8aa025df-05ef-40d7-915b-a0338e8c39e3";
  const payloads: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    if (payloads.length === 1) throw new TypeError("Disconnected");
    return json({
      data: { id: "previously-stored-message", clientMessageId: key },
    });
  };
  await assert.rejects(
    api.sendChatMessage("chat-7", "Network retry", key),
    (error: unknown) =>
      error instanceof ApiError && error.code === "NETWORK_ERROR",
  );
  const retried = await api.sendChatMessage("chat-7", "Network retry", key);
  assert.equal(retried.data.id, "previously-stored-message");
  assert.deepEqual(payloads, [
    { body: "Network retry", clientMessageId: key },
    { body: "Network retry", clientMessageId: key },
  ]);
});

test("chat server rate limit is presented as a typed API error", async () => {
  setAccessToken("synthetic-test-token");
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "CHAT_RATE_LIMIT",
          message: "Too many messages. Please try again shortly",
        },
      },
      429,
    );
  await assert.rejects(
    api.sendChatMessage(
      "chat-7",
      "Flood",
      "8aa025df-05ef-40d7-915b-a0338e8c39e3",
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 429 &&
      error.code === "CHAT_RATE_LIMIT",
  );
});

test("conversation block uses authenticated PATCH and explicit boolean", async () => {
  setAccessToken("synthetic-test-token");
  const methods: Array<{ method: string | undefined; value: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new URL(String(input)).pathname,
      "/api/conversations/chat-7/block",
    );
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-test-token",
    );
    methods.push({
      method: init?.method,
      value: JSON.parse(String(init?.body)),
    });
    return json({
      data: { blocked: Boolean(JSON.parse(String(init?.body)).blocked) },
    });
  };
  const blocked = await api.conversationBlock("chat-7", true);
  const unblocked = await api.conversationBlock("chat-7", false);
  assert.equal(blocked.data.blocked, true);
  assert.equal(unblocked.data.blocked, false);
  assert.deepEqual(methods, [
    { method: "PATCH", value: { blocked: true } },
    { method: "PATCH", value: { blocked: false } },
  ]);
});

test("private conversation report validates bearer authentication and body", async () => {
  setAccessToken("synthetic-test-token");
  const attempts: Array<{
    path: string;
    body: unknown;
    method: string | undefined;
  }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-test-token",
    );
    attempts.push({
      path: new URL(String(input)).pathname,
      body: JSON.parse(String(init?.body)),
      method: init?.method,
    });
    return json({ data: { id: "report-1", recorded: true } });
  };
  const reply = await api.conversationReport(
    "chat/7",
    "SCAM",
    "   Suspicious link  ",
  );
  assert.equal(reply.data.recorded, true);
  assert.deepEqual(attempts, [
    {
      path: "/api/conversations/chat%2F7/report",
      method: "POST",
      body: { reason: "SCAM", details: "Suspicious link" },
    },
  ]);
});

test("private reports cannot be sent when signed out", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json({});
  };
  await assert.rejects(api.conversationReport("chat-7", "SPAM"), ApiError);
  assert.equal(calls, 0);
});

test("moderation review uses bearer authentication and encoded report IDs", async () => {
  setAccessToken("synthetic-admin-token");
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    seen.push(`${init?.method ?? "GET"} ${url.pathname}`);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-admin-token",
    );
    if (init?.method === "PATCH") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        status: "REVIEWED",
        expectedStatus: "PENDING",
        note: "Checked by staff",
      });
      return json({ data: { status: "REVIEWED", action: { id: "audit-1" } } });
    }
    return json({
      data: [{ id: "audit-1", fromStatus: "PENDING", toStatus: "REVIEWED" }],
    });
  };
  const reviewed = await api.adminChatReportStatus(
    "report/7",
    "REVIEWED",
    "PENDING",
    "Checked by staff",
  );
  const history = await api.adminChatReportHistory("report/7");
  assert.equal(reviewed.data.status, "REVIEWED");
  assert.equal(history.data[0]?.id, "audit-1");
  assert.deepEqual(seen, [
    "PATCH /api/admin/chat-reports/report%2F7/status",
    "GET /api/admin/chat-reports/report%2F7/history",
  ]);
});

test("signed-out users cannot access moderation review or audit history", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return json({});
  };
  await assert.rejects(
    api.adminChatReportStatus("r", "CLOSED", "REVIEWED"),
    ApiError,
  );
  await assert.rejects(api.adminChatReportHistory("r"), ApiError);
  assert.equal(calls, 0);
});

test("stale moderation review returns a typed conflict", async () => {
  setAccessToken("synthetic-admin-token");
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "REPORT_STATUS_CONFLICT",
          message: "Report status has changed",
        },
      },
      409,
    );
  await assert.rejects(
    api.adminChatReportStatus("r", "REVIEWED", "PENDING"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "REPORT_STATUS_CONFLICT",
  );
});
