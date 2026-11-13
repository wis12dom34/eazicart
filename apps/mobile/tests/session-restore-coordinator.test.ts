import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionRestoreCoordinator } from "../src/lib/session-restore-coordinator";
import { SessionWriteGate } from "../src/lib/session-write-gate";

test("multiple recovery taps share one pending attempt and its result", async () => {
  const gate = new SessionWriteGate();
  const attempts = createSessionRestoreCoordinator();
  const events: string[] = [];
  let release!: () => void;
  const restore = async () => {
    events.push("restore");
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const run = () =>
    attempts.run(
      gate.capture(),
      (e) => gate.isCurrent(e),
      restore,
      () => events.push("loading"),
      () => events.push("settled"),
    );
  const first = run();
  const second = run();
  assert.equal(first, second);
  assert.deepEqual(events, ["loading", "restore"]);
  release();
  await first;
  assert.deepEqual(events, ["loading", "restore", "settled"]);
});

test("logout while restore is pending prevents the old loading update", async () => {
  const gate = new SessionWriteGate();
  const attempts = createSessionRestoreCoordinator();
  const events: string[] = [];
  let release!: () => void;
  const old = attempts.run(
    gate.capture(),
    (e) => gate.isCurrent(e),
    async () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    () => events.push("start"),
    () => events.push("old-settled"),
  );
  gate.invalidate();
  release();
  await old;
  assert.deepEqual(events, ["start"]);
});

test("old recovery completion cannot clear loading from a newer sign-in", async () => {
  const gate = new SessionWriteGate();
  const attempts = createSessionRestoreCoordinator();
  const events: string[] = [];
  let finishOld!: () => void;
  const old = attempts.run(
    gate.capture(),
    (e) => gate.isCurrent(e),
    async () =>
      new Promise<void>((resolve) => {
        finishOld = resolve;
      }),
    () => events.push("old-start"),
    () => events.push("old-settled"),
  );
  const nextEpoch = gate.invalidate();
  const next = attempts.run(
    nextEpoch,
    (e) => gate.isCurrent(e),
    async () => {},
    () => events.push("new-start"),
    () => events.push("new-settled"),
  );
  await next;
  finishOld();
  await old;
  assert.deepEqual(events, ["old-start", "new-start", "new-settled"]);
});

test("failed recovery settles only while current and can retry", async () => {
  const gate = new SessionWriteGate();
  const attempts = createSessionRestoreCoordinator();
  const events: string[] = [];
  const run = (restore: () => Promise<void>) =>
    attempts.run(
      gate.capture(),
      (e) => gate.isCurrent(e),
      restore,
      () => events.push("loading"),
      () => events.push("settled"),
    );
  await assert.rejects(
    run(async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  await run(async () => {
    events.push("retry");
  });
  assert.deepEqual(events, [
    "loading",
    "settled",
    "loading",
    "retry",
    "settled",
  ]);
});

test("an invalidated epoch never starts a recovery request", async () => {
  const gate = new SessionWriteGate();
  const attempts = createSessionRestoreCoordinator();
  const stale = gate.capture();
  gate.invalidate();
  let called = false;
  await attempts.run(
    stale,
    (e) => gate.isCurrent(e),
    async () => {
      called = true;
    },
    () => {
      called = true;
    },
    () => {
      called = true;
    },
  );
  assert.equal(called, false);
});
