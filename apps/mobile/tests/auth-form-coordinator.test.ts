import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthFormCoordinator } from "../src/lib/auth-form-coordinator";

test("two immediate sign-in taps start only one authentication request", async () => {
  const coordinator = createAuthFormCoordinator();
  let release!: () => void;
  let started = 0;
  const events: string[] = [];
  const options = {
    authenticate: async () => {
      started++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    onSuccess: () => events.push("success"),
    onError: () => events.push("error"),
    onSettled: () => events.push("settled"),
  };
  const first = coordinator.submit(options);
  assert.equal(coordinator.isBusy, true);
  assert.deepEqual(await coordinator.submit(options), { started: false });
  assert.equal(started, 1);
  release();
  assert.deepEqual(await first, { started: true });
  assert.deepEqual(events, ["success", "settled"]);
  assert.equal(coordinator.isBusy, false);
});

test("sign-in failure unlocks and registration may be attempted again", async () => {
  const coordinator = createAuthFormCoordinator();
  const events: string[] = [];
  const failed = await coordinator.submit({
    authenticate: async () => {
      throw new Error("bad password");
    },
    onSuccess: () => events.push("success"),
    onError: (error) =>
      events.push(error instanceof Error ? error.message : "error"),
    onSettled: () => events.push("settled"),
  });
  assert.deepEqual(failed, { started: true });
  assert.equal(coordinator.isBusy, false);
  const retried = await coordinator.submit({
    authenticate: async () => {},
    onSuccess: () => events.push("success"),
    onError: () => events.push("error"),
    onSettled: () => events.push("settled"),
  });
  assert.deepEqual(retried, { started: true });
  assert.deepEqual(events, ["bad password", "settled", "success", "settled"]);
});

test("unmount suppresses late success, navigation and settled callbacks", async () => {
  const coordinator = createAuthFormCoordinator();
  const events: string[] = [];
  let release!: () => void;
  const pending = coordinator.submit({
    authenticate: async () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    onSuccess: () => events.push("navigate"),
    onError: () => events.push("alert"),
    onSettled: () => events.push("state update"),
  });
  coordinator.invalidate();
  release();
  assert.deepEqual(await pending, { started: true });
  assert.deepEqual(events, []);
  assert.equal(coordinator.isBusy, false);
});

test("unmount suppresses late authentication errors and alerts", async () => {
  const coordinator = createAuthFormCoordinator();
  const events: string[] = [];
  let reject!: (error: Error) => void;
  const pending = coordinator.submit({
    authenticate: async () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
    onSuccess: () => events.push("success"),
    onError: () => events.push("alert"),
    onSettled: () => events.push("state update"),
  });
  coordinator.invalidate();
  reject(new Error("network"));
  assert.deepEqual(await pending, { started: true });
  assert.deepEqual(events, []);
});

test("no new request starts after form dismissal", async () => {
  const coordinator = createAuthFormCoordinator();
  coordinator.invalidate();
  let called = 0;
  assert.deepEqual(
    await coordinator.submit({
      authenticate: async () => {
        called++;
      },
      onSuccess: () => {},
      onError: () => {},
      onSettled: () => {},
    }),
    { started: false },
  );
  assert.equal(called, 0);
});

test("UI errors do not leave the login or register form locked", async () => {
  const coordinator = createAuthFormCoordinator();
  await coordinator.submit({
    authenticate: async () => {},
    onSuccess: () => {
      throw new Error("navigation");
    },
    onError: () => {},
    onSettled: () => {},
  });
  assert.equal(coordinator.isBusy, false);
  assert.deepEqual(
    await coordinator.submit({
      authenticate: async () => {},
      onSuccess: () => {},
      onError: () => {},
      onSettled: () => {},
    }),
    { started: true },
  );
});
