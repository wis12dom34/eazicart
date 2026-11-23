import { describe, expect, it } from "vitest";
import { MemoryBrowserAccountStore } from "../src/modules/auth/browser-account-store.js";
const future = () => new Date(Date.now() + 60000);
const record = (userId: string, refreshTokenHash: string) => ({
  userId,
  refreshTokenHash,
  expiresAt: future(),
});
describe("browser account store contract", () => {
  it("retains multiple users and switches without discarding the other", async () => {
    const store = new MemoryBrowserAccountStore();
    const d = await store.createDevice("hash", future());
    await store.addAccount(d.id, record("a", "hash-a"));
    await store.addAccount(d.id, record("b", "hash-b"));
    expect((await store.listAccounts(d.id)).map((a) => a.userId)).toEqual([
      "a",
      "b",
    ]);
    expect(await store.selectAccount(d.id, "a")).toBe(true);
    expect((await store.findDevice("hash"))?.activeUserId).toBe("a");
    expect(await store.selectAccount(d.id, "b")).toBe(true);
    expect(await store.listAccounts(d.id)).toHaveLength(2);
  });
  it("does not allow switching to another device account", async () => {
    const s = new MemoryBrowserAccountStore();
    const a = await s.createDevice("a", future());
    const b = await s.createDevice("b", future());
    await s.addAccount(a.id, record("user", "token"));
    expect(await s.selectAccount(b.id, "user")).toBe(false);
  });
  it("rotates only matching unexpired tokens", async () => {
    const s = new MemoryBrowserAccountStore();
    const d = await s.createDevice("h", future());
    await s.addAccount(d.id, record("a", "old"));
    expect(await s.rotateAccountToken(d.id, "a", "bad", "new", future())).toBe(
      false,
    );
    expect(await s.rotateAccountToken(d.id, "a", "old", "new", future())).toBe(
      true,
    );
    expect(
      await s.rotateAccountToken(d.id, "a", "old", "replay", future()),
    ).toBe(false);
  });
  it("removes only selected account, or all accounts explicitly", async () => {
    const s = new MemoryBrowserAccountStore();
    const d = await s.createDevice("h", future());
    await s.addAccount(d.id, record("a", "a"));
    await s.addAccount(d.id, record("b", "b"));
    expect(await s.removeAccount(d.id, "b")).toBe(true);
    expect((await s.listAccounts(d.id)).map((a) => a.userId)).toEqual(["a"]);
    await s.removeAllAccounts(d.id);
    expect(await s.listAccounts(d.id)).toHaveLength(0);
  });
  it("rejects expired device and account", async () => {
    const s = new MemoryBrowserAccountStore();
    const d = await s.createDevice("h", new Date(0));
    await s.addAccount(d.id, {
      ...record("a", "token"),
      expiresAt: new Date(0),
    });
    expect(await s.findDevice("h")).toBeUndefined();
    expect(await s.selectAccount(d.id, "a")).toBe(false);
  });
});
