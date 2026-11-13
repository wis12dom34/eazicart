import assert from "node:assert/strict";
import { test } from "node:test";
import { createExclusiveMutationGate } from "../src/lib/exclusive-mutation-gate";

test("a second rapid mutation is refused before a React render occurs", async () => {
  const gate = createExclusiveMutationGate();
  let finish!: (result: number) => void;
  const first = gate.run(
    async () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  assert.equal(gate.isBusy, true);
  let duplicateCalls = 0;
  const duplicate = await gate.run(async () => {
    duplicateCalls++;
    return 9;
  });
  assert.deepEqual(duplicate, { started: false });
  assert.equal(duplicateCalls, 0);
  finish(4);
  assert.deepEqual(await first, { started: true, value: 4 });
  assert.equal(gate.isBusy, false);
});

test("clear/delete and quantity/save share one lock rather than racing", async () => {
  const gate = createExclusiveMutationGate();
  const calls: string[] = [];
  let finish!: () => void;
  const pending = gate.run(async () => {
    calls.push("cart quantity");
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const blocked = await gate.run(async () => {
    calls.push("clear cart");
  });
  assert.deepEqual(blocked, { started: false });
  assert.deepEqual(calls, ["cart quantity"]);
  finish();
  assert.equal((await pending).started, true);
  assert.equal(
    (
      await gate.run(async () => {
        calls.push("clear cart");
      })
    ).started,
    true,
  );
  assert.deepEqual(calls, ["cart quantity", "clear cart"]);
});

test("a rejected API call always releases the gate", async () => {
  const gate = createExclusiveMutationGate();
  await assert.rejects(
    gate.run(async () => {
      throw new Error("Failed API request");
    }),
    /Failed API request/,
  );
  assert.equal(gate.isBusy, false);
  assert.deepEqual(await gate.run(async () => "retry"), {
    started: true,
    value: "retry",
  });
});

test("synchronous task exceptions release the gate too", async () => {
  const gate = createExclusiveMutationGate();
  await assert.rejects(
    gate.run(() => {
      throw new Error("bad task");
    }),
    /bad task/,
  );
  assert.equal(gate.isBusy, false);
  assert.equal((await gate.run(async () => 1)).started, true);
});

test("the lock stays acquired through async cleanup", async () => {
  const gate = createExclusiveMutationGate();
  let finishCleanup!: () => void;
  const cleanup = new Promise<void>((resolve) => {
    finishCleanup = resolve;
  });
  const pending = gate.run(async () => {
    await cleanup;
    return "done";
  });
  assert.equal((await gate.run(async () => "duplicate")).started, false);
  finishCleanup();
  assert.deepEqual(await pending, { started: true, value: "done" });
  assert.equal((await gate.run(async () => "next")).started, true);
});
