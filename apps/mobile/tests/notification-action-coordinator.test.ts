import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotificationActionCoordinator } from "../src/lib/notification-action-coordinator";

test("mark one and mark all cannot overlap even before a React rerender", async () => {
  const coordinator = createNotificationActionCoordinator();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  let readAll = 0;
  let refreshes = 0;
  const first = coordinator.run(
    "alice",
    () => "alice",
    async () => {
      reads++;
      await hold;
    },
    async () => {
      refreshes++;
    },
  );
  assert.equal(coordinator.isBusy, true);
  const duplicate = await coordinator.run(
    "alice",
    () => "alice",
    async () => {
      readAll++;
    },
    async () => {
      refreshes++;
    },
  );
  assert.deepEqual(duplicate, { started: false });
  assert.equal(readAll, 0);
  release();
  assert.deepEqual(await first, { started: true });
  assert.equal(reads, 1);
  assert.equal(refreshes, 1);
  assert.equal(coordinator.isBusy, false);
});

test("successful mark all refreshes the current account only", async () => {
  const coordinator = createNotificationActionCoordinator();
  const calls: string[] = [];
  const result = await coordinator.run(
    "alice",
    () => "alice",
    async () => {
      calls.push("mark-all");
    },
    async () => {
      calls.push("invalidate-alice");
    },
  );
  assert.equal(result.started, true);
  assert.deepEqual(calls, ["mark-all", "invalidate-alice"]);
});

test("account switching during an old notification mutation skips stale cache refresh", async () => {
  const coordinator = createNotificationActionCoordinator();
  let account: string | null = "alice";
  let release!: () => void;
  const pending = coordinator.run(
    "alice",
    () => account,
    async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    async () => {
      throw new Error("Old account must not refresh");
    },
  );
  account = "bob";
  release();
  assert.deepEqual(await pending, { started: true });
  assert.equal(coordinator.isBusy, false);
});

test("a stale logged-out or wrong-account action never starts a network call", async () => {
  const coordinator = createNotificationActionCoordinator();
  let calls = 0;
  const action = async () => {
    calls++;
  };
  const refresh = async () => {
    calls++;
  };
  assert.deepEqual(await coordinator.run(null, () => null, action, refresh), {
    started: false,
  });
  assert.deepEqual(
    await coordinator.run("alice", () => "bob", action, refresh),
    { started: false },
  );
  assert.equal(calls, 0);
});

test("API errors release the gate and do not refresh the cache", async () => {
  const coordinator = createNotificationActionCoordinator();
  let refreshes = 0;
  await assert.rejects(
    coordinator.run(
      "alice",
      () => "alice",
      async () => {
        throw new Error("unavailable");
      },
      async () => {
        refreshes++;
      },
    ),
    /unavailable/,
  );
  assert.equal(coordinator.isBusy, false);
  assert.equal(refreshes, 0);
  assert.deepEqual(
    await coordinator.run(
      "alice",
      () => "alice",
      async () => {},
      async () => {
        refreshes++;
      },
    ),
    { started: true },
  );
  assert.equal(refreshes, 1);
});
