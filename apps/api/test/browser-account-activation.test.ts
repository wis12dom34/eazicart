import { expect, it } from "vitest";
import { MemoryBrowserAccountStore } from "../src/modules/auth/browser-account-store.js";

it("atomically changes the active account and rotates only its generation", async () => {
  const store = new MemoryBrowserAccountStore();
  const expiresAt = new Date(Date.now() + 60_000);
  const device = await store.createDevice("device", expiresAt);
  await store.addAccount(device.id, {
    userId: "first",
    refreshTokenHash: "first-old",
    expiresAt,
  });
  await store.addAccount(device.id, {
    userId: "second",
    refreshTokenHash: "second-old",
    expiresAt,
  });
  const input = {
    deviceId: device.id,
    expectedActiveUserId: "second",
    userId: "first",
    expectedHash: "first-old",
    nextHash: "first-new",
  };
  expect(
    await store.activateAccount({ ...input, expectedActiveUserId: "stale" }),
  ).toBe(false);
  expect(await store.findActiveGeneration(device.id, "device", "second")).toBe(
    "second-old",
  );
  const results = await Promise.all([
    store.activateAccount(input),
    store.activateAccount(input),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await store.findActiveGeneration(device.id, "device", "first")).toBe(
    "first-new",
  );
  expect(
    await store.findActiveGeneration(device.id, "device", "second"),
  ).toBeUndefined();
  expect(
    (await store.listAccounts(device.id)).find((a) => a.userId === "second")
      ?.expiresAt,
  ).toEqual(expiresAt);
});
