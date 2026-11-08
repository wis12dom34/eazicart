import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionWriteGate } from "../src/lib/session-write-gate";

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test("writes for the active session are accepted", async () => {
  const gate = new SessionWriteGate();
  const calls: string[] = [];
  assert.equal(
    await gate.writeIfCurrent(gate.capture(), async () => {
      calls.push("saved");
    }),
    true,
  );
  assert.deepEqual(calls, ["saved"]);
});

test("queued stale token writes cannot run after logout", async () => {
  const gate = new SessionWriteGate();
  const hold = deferred();
  const started = deferred();
  const calls: string[] = [];
  const oldEpoch = gate.capture();
  const first = gate.writeIfCurrent(oldEpoch, async () => {
    calls.push("old-start");
    started.release();
    await hold.promise;
    calls.push("old-finish");
  });
  const stale = gate.writeIfCurrent(oldEpoch, async () => {
    calls.push("stale-write");
  });
  await started.promise;
  gate.invalidate();
  const clear = gate.enqueue(async () => {
    calls.push("clear");
  });
  hold.release();
  assert.equal(await first, false);
  assert.equal(await stale, false);
  await clear;
  assert.deepEqual(calls, ["old-start", "old-finish", "clear"]);
});

test("a new login writes after the old logout cleanup", async () => {
  const gate = new SessionWriteGate();
  const calls: string[] = [];
  gate.invalidate();
  const clear = gate.enqueue(async () => calls.push("clear-old"));
  const next = gate.invalidate();
  const login = gate.writeIfCurrent(next, async () => {
    calls.push("save-new");
  });
  await clear;
  assert.equal(await login, true);
  assert.deepEqual(calls, ["clear-old", "save-new"]);
});

test("stale session reads and requests are distinguishable by epoch", () => {
  const gate = new SessionWriteGate();
  const before = gate.capture();
  gate.invalidate();
  assert.equal(gate.isCurrent(before), false);
  assert.equal(gate.isCurrent(gate.capture()), true);
});

test("failed storage writes do not poison subsequent cleanup", async () => {
  const gate = new SessionWriteGate();
  await assert.rejects(
    gate.writeIfCurrent(gate.capture(), async () => {
      throw new Error("SecureStore unavailable");
    }),
  );
  const calls: string[] = [];
  await gate.enqueue(async () => calls.push("clear"));
  assert.deepEqual(calls, ["clear"]);
});
