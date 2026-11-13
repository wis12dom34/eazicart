import assert from "node:assert/strict";
import { test } from "node:test";
import { createChatBlockCoordinator } from "../src/lib/chat-block-coordinator";

function fixture() {
  let current = {
    accountId: "alice" as string | null,
    conversationId: "chat-1" as string | null,
    blockedByMe: false,
  };
  const calls: Array<[string, boolean]> = [];
  const refreshes: string[] = [];
  const request = (
    changeBlocked: (
      chatId: string,
      value: boolean,
    ) => Promise<unknown> = async (id, value) => {
      calls.push([id, value]);
    },
  ) => ({
    expected: { ...current },
    currentScope: () => ({ ...current }),
    changeBlocked,
    refresh: async (accountId: string) => {
      refreshes.push(accountId);
    },
  });
  return {
    request,
    calls,
    refreshes,
    update: (patch: Partial<typeof current>) => {
      current = { ...current, ...patch };
    },
  };
}

test("two rapid confirmations produce exactly one block call", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  let release!: () => void;
  const request = f.request(async (chat, value) => {
    f.calls.push([chat, value]);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const first = gate.confirm(request);
  assert.equal(gate.isBusy, true);
  assert.deepEqual(await gate.confirm(request), { started: false });
  assert.deepEqual(f.calls, [["chat-1", true]]);
  release();
  assert.deepEqual(await first, { started: true });
  assert.deepEqual(f.refreshes, ["alice"]);
  assert.deepEqual(await gate.confirm(request), { started: false });
});

test("stale modal confirmation after account or conversation switch is refused", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  const old = f.request();
  f.update({ accountId: "bob" });
  assert.deepEqual(await gate.confirm(old), { started: false });
  f.update({ accountId: "alice", conversationId: "chat-2" });
  assert.deepEqual(await gate.confirm(old), { started: false });
  assert.deepEqual(f.calls, []);
});

test("changed block state in stale modal does not reverse newer state", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  const old = f.request();
  f.update({ blockedByMe: true });
  assert.deepEqual(await gate.confirm(old), { started: false });
  assert.deepEqual(f.calls, []);
});

test("block then unblock uses the new observed state", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  assert.deepEqual(await gate.confirm(f.request()), { started: true });
  f.update({ blockedByMe: true });
  assert.deepEqual(await gate.confirm(f.request()), { started: true });
  assert.deepEqual(f.calls, [
    ["chat-1", true],
    ["chat-1", false],
  ]);
  assert.deepEqual(f.refreshes, ["alice", "alice"]);
});

test("in-flight success after switching users does not refresh stale account", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  let release!: () => void;
  const old = f.request(async (chat, blocked) => {
    f.calls.push([chat, blocked]);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const pending = gate.confirm(old);
  f.update({ accountId: "bob" });
  release();
  assert.deepEqual(await pending, { started: true });
  assert.deepEqual(f.refreshes, []);
  assert.equal(gate.isBusy, false);
});

test("failed server write releases guard for retry", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  await assert.rejects(
    gate.confirm(
      f.request(async () => {
        throw new Error("network");
      }),
    ),
    /network/,
  );
  assert.equal(gate.isBusy, false);
  assert.deepEqual(await gate.confirm(f.request()), { started: true });
  assert.deepEqual(f.calls, [["chat-1", true]]);
});

test("cache-refresh failure never makes a successful write retryable", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  const request = f.request();
  request.refresh = async () => {
    throw new Error("cache failed");
  };
  assert.deepEqual(await gate.confirm(request), { started: true });
  assert.deepEqual(await gate.confirm(request), { started: false });
  assert.deepEqual(f.calls, [["chat-1", true]]);
});

test("missing account or conversation cannot update block status", async () => {
  const f = fixture();
  const gate = createChatBlockCoordinator();
  f.update({ accountId: null });
  assert.deepEqual(await gate.confirm(f.request()), { started: false });
  f.update({ accountId: "alice", conversationId: null });
  assert.deepEqual(await gate.confirm(f.request()), { started: false });
  assert.deepEqual(f.calls, []);
});
