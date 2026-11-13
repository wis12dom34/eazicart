import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChatReportCoordinator,
  isUncertainChatReportError,
  type ChatReportPayload,
} from "../src/lib/chat-report-coordinator";

function fixture() {
  let account: string | null = "alice";
  let chat: string | null = "chat-one";
  const sent: ChatReportPayload[] = [];
  let confirmed = 0;
  const options = (
    changes: Partial<
      Parameters<ReturnType<typeof createChatReportCoordinator>["submit"]>[0]
    > = {},
  ) => ({
    scope: { accountId: account, conversationId: chat },
    currentScope: () => ({ accountId: account, conversationId: chat }),
    reason: "SCAM" as const,
    details: "  suspicious link  ",
    send: async (payload: ChatReportPayload) => {
      sent.push(payload);
    },
    confirmed: () => {
      confirmed++;
    },
    ...changes,
  });
  return {
    options,
    sent,
    get confirmed() {
      return confirmed;
    },
    changeAccount: (value: string | null) => {
      account = value;
    },
    changeChat: (value: string | null) => {
      chat = value;
    },
  };
}

test("rapid duplicate report taps perform only one API write", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  let release!: () => void;
  const pending = gate.submit(
    f.options({
      send: async (payload) => {
        f.sent.push(payload);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    }),
  );
  assert.equal(gate.isBusy, true);
  assert.deepEqual(await gate.submit(f.options()), { started: false });
  assert.deepEqual(f.sent, [
    {
      conversationId: "chat-one",
      reason: "SCAM",
      details: "suspicious link",
    },
  ]);
  release();
  assert.deepEqual(await pending, { started: true });
  assert.equal(f.confirmed, 1);
  assert.equal(gate.isBusy, false);
});

test("successful report cannot be sent again before screen rerenders", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  assert.deepEqual(await gate.submit(f.options()), { started: true });
  assert.deepEqual(await gate.submit(f.options({ reason: "SPAM" })), {
    started: false,
  });
  assert.equal(f.sent.length, 1);
  assert.equal(f.confirmed, 1);
});

test("changing accounts or conversations invalidates an old confirmation", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  const old = f.options();
  f.changeAccount("bob");
  assert.deepEqual(await gate.submit(old), { started: false });
  f.changeAccount("alice");
  f.changeChat("chat-two");
  assert.deepEqual(await gate.submit(old), { started: false });
  assert.equal(f.sent.length, 0);
});

test("late response after account switch cannot show stale success", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  let release!: () => void;
  const pending = gate.submit(
    f.options({
      send: async (payload) => {
        f.sent.push(payload);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    }),
  );
  f.changeAccount("bob");
  release();
  assert.deepEqual(await pending, { started: true });
  assert.equal(f.confirmed, 0);
  assert.deepEqual(await gate.submit(f.options()), { started: true });
  assert.equal(f.confirmed, 1);
});

test("failed request releases lock and permits explicit retry", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  await assert.rejects(
    gate.submit(
      f.options({
        send: async () => {
          throw new Error("server unavailable");
        },
      }),
    ),
    /server unavailable/,
  );
  assert.equal(gate.isBusy, false);
  assert.deepEqual(await gate.submit(f.options()), { started: true });
  assert.equal(f.sent.length, 1);
});

test("input is validated and trimmed once before making the request", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  for (const changes of [
    { reason: null },
    { reason: "INVALID" as "SCAM" },
    { details: "x".repeat(1001) },
    { scope: { accountId: null, conversationId: "chat-one" } },
    { scope: { accountId: "alice", conversationId: null } },
  ]) {
    assert.deepEqual(await gate.submit(f.options(changes)), { started: false });
  }
  assert.equal(f.sent.length, 0);
  assert.deepEqual(await gate.submit(f.options({ details: "  details  " })), {
    started: true,
  });
  assert.equal(f.sent[0].details, "details");
});

test("draft editing during pending request does not alter submitted payload", async () => {
  const gate = createChatReportCoordinator();
  const f = fixture();
  let release!: () => void;
  const pending = gate.submit(
    f.options({
      details: "  original  ",
      send: async (payload) => {
        f.sent.push(payload);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    }),
  );
  release();
  await pending;
  assert.equal(f.sent[0].details, "original");
});

test("timeout or network error is uncertain, not a definite failed report", () => {
  assert.equal(isUncertainChatReportError({ code: "TIMEOUT" }), true);
  assert.equal(isUncertainChatReportError({ code: "NETWORK_ERROR" }), true);
  assert.equal(isUncertainChatReportError({ code: "FORBIDDEN" }), false);
  assert.equal(isUncertainChatReportError(new Error("other")), false);
});
