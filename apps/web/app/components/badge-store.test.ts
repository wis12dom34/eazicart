import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../lib/api/client";
vi.mock("../../lib/api/client", () => ({ apiRequest: vi.fn() }));
const badge = { variant: "pro" as const, expiresAt: "2026-11-06T12:00:35Z" };
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.mocked(apiRequest).mockReset();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("shared badge refresh scheduler", () => {
  it("does not postpone refresh as a long feed mounts more names", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { paid: badge } });
    const store = await import("./badge-store");
    const off = [store.subscribeBadge("paid", badge, vi.fn())];
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(5000);
      off.push(store.subscribeBadge(`free-${i}`, null, vi.fn()));
    }
    await vi.advanceTimersByTimeAsync(5000);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    off.forEach((fn) => fn());
    expect(vi.getTimerCount()).toBe(0);
  });
  it("hides at the exact expiry while a refresh request is still pending", async () => {
    let finish!: (result: { data: Record<string, typeof badge> }) => void;
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const store = await import("./badge-store");
    const listener = vi.fn();
    const off = store.subscribeBadge("paid", badge, listener);
    await vi.advanceTimersByTimeAsync(30000);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    listener.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(listener).toHaveBeenCalled();
    expect(store.readBadge("paid", badge)).toBeNull();
    finish({ data: { paid: badge } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.readBadge("paid", badge)).toBeNull();
    off();
  });
  it("fails closed and does not apply a stale response to a remounted account", async () => {
    let finish!: (result: { data: Record<string, typeof badge> }) => void;
    vi.mocked(apiRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const store = await import("./badge-store");
    const offOld = store.subscribeBadge("paid", badge, vi.fn());
    await vi.advanceTimersByTimeAsync(30000);
    offOld();
    const offNew = store.subscribeBadge("paid", null, vi.fn());
    finish({ data: { paid: badge } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.readBadge("paid", null)).toBeNull();
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("offline"));
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.readBadge("paid", null)).toBeNull();
    offNew();
  });
});
