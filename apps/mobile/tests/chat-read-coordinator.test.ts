import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChatReadCoordinator,
  shouldShowConversationLoadError,
} from "../src/lib/chat-read-coordinator";

function fixture() {
  let account: string | null = "alice";
  let conversation = "chat-1";
  const sent: string[] = [];
  const refreshed: string[] = [];
  const request = (message: string) => ({
    accountId: account,
    conversationId: conversation,
    newestMessageId: message,
    currentScope: () => ({ accountId: account, conversationId: conversation }),
    send: async (id: string) => {
      sent.push(id);
    },
    refresh: async (id: string) => {
      refreshed.push(id);
    },
  });
  return {
    request,
    sent,
    refreshed,
    setAccount: (next: string | null) => {
      account = next;
    },
    setConversation: (next: string) => {
      conversation = next;
    },
  };
}

test("the same message is acknowledged once across repeated polls", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  assert.deepEqual(await gate.acknowledge(f.request("m1")), { started: true });
  assert.deepEqual(await gate.acknowledge(f.request("m1")), { started: false });
  assert.deepEqual(f.sent, ["chat-1"]);
  assert.deepEqual(f.refreshed, ["alice"]);
});

test("a newer message arriving during a pending receipt is acknowledged afterward", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  let release!: () => void;
  const slow = f.request("m1");
  slow.send = async (id: string) => {
    f.sent.push(id);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const pending = gate.acknowledge(slow);
  assert.equal(gate.isBusy, true);
  assert.deepEqual(await gate.acknowledge(f.request("m2")), { started: false });
  release();
  assert.deepEqual(await pending, { started: true });
  assert.deepEqual(f.sent, ["chat-1", "chat-1"]);
  assert.deepEqual(f.refreshed, ["alice", "alice"]);
  assert.equal(gate.isBusy, false);
});

test("coalesces several arriving messages into only the newest receipt", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  let release!: () => void;
  const first = f.request("m1");
  first.send = async (id: string) => {
    f.sent.push(id);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const pending = gate.acknowledge(first);
  await gate.acknowledge(f.request("m2"));
  await gate.acknowledge(f.request("m3"));
  release();
  await pending;
  assert.deepEqual(f.sent, ["chat-1", "chat-1"]);
  assert.deepEqual(await gate.acknowledge(f.request("m3")), { started: false });
});

test("account switch mid-read never invalidates the old user's conversation cache", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  let release!: () => void;
  const old = f.request("m1");
  old.send = async (id: string) => {
    f.sent.push(id);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const pending = gate.acknowledge(old);
  f.setAccount("bob");
  await gate.acknowledge(f.request("m9"));
  release();
  await pending;
  assert.deepEqual(f.refreshed, ["bob"]);
  assert.deepEqual(f.sent, ["chat-1", "chat-1"]);
});

test("switching chats uses a new receipt scope", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  await gate.acknowledge(f.request("m1"));
  f.setConversation("chat-2");
  await gate.acknowledge(f.request("m1"));
  assert.deepEqual(f.sent, ["chat-1", "chat-2"]);
});

test("a failed read unlocks and can be retried after the next poll", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  let calls = 0;
  const request = f.request("m1");
  request.send = async () => {
    if (++calls === 1) throw new Error("network");
  };
  await assert.rejects(gate.acknowledge(request), /network/);
  assert.equal(gate.isBusy, false);
  await gate.acknowledge(request);
  assert.equal(calls, 2);
  assert.deepEqual(f.refreshed, ["alice"]);
});

test("cache refresh errors do not cause duplicate API receipts", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  const request = f.request("m1");
  request.refresh = async () => {
    throw new Error("cache unavailable");
  };
  assert.deepEqual(await gate.acknowledge(request), { started: true });
  assert.deepEqual(await gate.acknowledge(f.request("m1")), { started: false });
  assert.deepEqual(f.sent, ["chat-1"]);
});

test("missing account, chat or message never sends a receipt", async () => {
  const f = fixture();
  const gate = createChatReadCoordinator();
  for (const data of [
    { accountId: null },
    { conversationId: null },
    { newestMessageId: null },
    { accountId: "someone-else" },
  ]) {
    assert.deepEqual(await gate.acknowledge({ ...f.request("m1"), ...data }), {
      started: false,
    });
  }
  assert.deepEqual(f.sent, []);
});

test("older-page errors keep already-loaded messages visible", () => {
  assert.equal(
    shouldShowConversationLoadError({
      messageError: true,
      hasMessageData: true,
      membershipError: false,
    }),
    false,
  );
  assert.equal(
    shouldShowConversationLoadError({
      messageError: true,
      hasMessageData: false,
      membershipError: false,
    }),
    true,
  );
  assert.equal(
    shouldShowConversationLoadError({
      messageError: false,
      hasMessageData: true,
      membershipError: true,
    }),
    true,
  );
});
