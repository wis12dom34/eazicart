import assert from "node:assert/strict";
import { test } from "node:test";
import { createChatSendCoordinator } from "../src/lib/chat-send-coordinator";

const base = () => {
  let account: string | null = "alice";
  let conversation = "chat-1";
  let count = 0;
  const sent: Array<{ body: string; key: string; productId?: string }> = [];
  const confirmed: string[] = [];
  const options = (override: Record<string, unknown> = {}) => ({
    accountId: account,
    conversationId: conversation,
    body: " Hello ",
    currentScope: () => ({ accountId: account, conversationId: conversation }),
    makeKey: () => "uuid-" + ++count,
    send: async (payload: {
      body: string;
      key: string;
      productId?: string;
    }) => {
      sent.push(payload);
    },
    confirmed: (payload: { key: string }) => {
      confirmed.push(payload.key);
    },
    ...override,
  });
  return {
    options,
    sent,
    confirmed,
    get keysCreated() {
      return count;
    },
    setAccount: (value: string | null) => {
      account = value;
    },
    setConversation: (value: string) => {
      conversation = value;
    },
  };
};

test("two immediate taps dispatch only one message and preserve its snapshot", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  let release!: () => void;
  const pending = coordinator.submit(
    fixture.options({
      send: async (payload: { body: string; key: string }) => {
        fixture.sent.push(payload);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    }),
  );
  assert.equal(coordinator.isBusy, true);
  assert.deepEqual(await coordinator.submit(fixture.options()), {
    started: false,
  });
  assert.equal(fixture.keysCreated, 1);
  assert.deepEqual(fixture.sent, [{ body: "Hello", key: "uuid-1" }]);
  release();
  assert.deepEqual(await pending, { started: true });
  assert.deepEqual(fixture.confirmed, ["uuid-1"]);
  assert.equal(coordinator.isBusy, false);
});

test("network uncertainty retries exact payload with same idempotency key", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  let attempt = 0;
  const send = async (payload: { body: string; key: string }) => {
    fixture.sent.push(payload);
    if (++attempt === 1) throw new Error("timeout");
  };
  await assert.rejects(
    coordinator.submit(fixture.options({ send })),
    /timeout/,
  );
  assert.deepEqual(await coordinator.submit(fixture.options({ send })), {
    started: true,
  });
  assert.deepEqual(
    fixture.sent.map((x) => x.key),
    ["uuid-1", "uuid-1"],
  );
  assert.equal(fixture.keysCreated, 1);
});

test("editing message or changing product uses a fresh key after a failed send", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  const failure = async (payload: {
    body: string;
    key: string;
    productId?: string;
  }) => {
    fixture.sent.push(payload);
    throw new Error("offline");
  };
  await assert.rejects(coordinator.submit(fixture.options({ send: failure })));
  await assert.rejects(
    coordinator.submit(fixture.options({ body: "changed", send: failure })),
  );
  await assert.rejects(
    coordinator.submit(
      fixture.options({
        body: "changed",
        productId: "product-2",
        send: failure,
      }),
    ),
  );
  assert.deepEqual(
    fixture.sent.map((x) => x.key),
    ["uuid-1", "uuid-2", "uuid-3"],
  );
});

test("failed message keys cannot cross accounts or conversations", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  const fail = async (payload: { body: string; key: string }) => {
    fixture.sent.push(payload);
    throw new Error("offline");
  };
  await assert.rejects(coordinator.submit(fixture.options({ send: fail })));
  fixture.setConversation("chat-2");
  await assert.rejects(coordinator.submit(fixture.options({ send: fail })));
  fixture.setAccount("bob");
  await assert.rejects(coordinator.submit(fixture.options({ send: fail })));
  assert.deepEqual(
    fixture.sent.map((x) => x.key),
    ["uuid-1", "uuid-2", "uuid-3"],
  );
});

test("a stale completion must not clear another account's message composer", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  let release!: () => void;
  const pending = coordinator.submit(
    fixture.options({
      send: async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    }),
  );
  fixture.setAccount("bob");
  release();
  assert.deepEqual(await pending, { started: true });
  assert.equal(fixture.confirmed.length, 0);
  assert.equal(coordinator.isBusy, false);
});

test("blocked, signed out, blank or too-long messages never send", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  for (const patch of [
    { blocked: true },
    { accountId: null },
    { body: " " },
    { body: "x".repeat(4001) },
    { accountId: "wrong-user" },
  ]) {
    assert.deepEqual(await coordinator.submit(fixture.options(patch)), {
      started: false,
    });
  }
  assert.equal(fixture.sent.length, 0);
  assert.equal(fixture.keysCreated, 0);
});

test("product-only message is allowed with its own idempotency key", async () => {
  const coordinator = createChatSendCoordinator();
  const fixture = base();
  await coordinator.submit(
    fixture.options({ body: "", productId: "product-1" }),
  );
  assert.deepEqual(fixture.sent, [
    { body: "", key: "uuid-1", productId: "product-1" },
  ]);
});
