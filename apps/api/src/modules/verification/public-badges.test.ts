import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@eazicart/database";
import { registerPublicBadges } from "./public-badges.js";
type Output = {
  data: { badge?: unknown; seller: { badge: { variant: string } | null } }[];
};
const active = {
  status: "ACTIVE",
  planCode: "BUSINESS",
  startsAt: new Date("2020-01-01"),
  currentPeriodEnd: new Date("2099-01-01"),
  suspendedAt: null,
  payment: {
    status: "SUCCESS",
    planCode: "BUSINESS",
    settledAt: new Date("2020-01-01"),
  },
};
describe("public badge DTOs", () => {
  it("batches a long feed, decorates account nodes, exposes no paid evidence and honors suspension on the next request", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "u1",
        verificationSuspendedAt: null,
        subscriptions: [active],
        sellerProfile: null,
      },
    ]);
    const app = Fastify();
    registerPublicBadges(app, {
      user: { findMany },
    } as unknown as PrismaClient);
    app.get("/fixture", () => ({
      data: Array.from({ length: 100 }, (_, i) => ({
        id: `p${i}`,
        name: "Product",
        seller: { id: "s1", displayName: "Shop", userId: "u1" },
      })),
    }));
    const first = await app.inject("/fixture");
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(
      (findMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } }).where
        .id.in,
    ).toEqual(["u1"]);
    expect(first.json<Output>().data[0]!.seller.badge?.variant).toBe(
      "business",
    );
    expect(first.json<Output>().data[0]!.badge).toBeUndefined();
    expect(first.body).not.toContain("settledAt");
    expect(first.headers["cache-control"]).toBe("private, no-store");
    findMany.mockResolvedValue([
      {
        id: "u1",
        verificationSuspendedAt: new Date(),
        subscriptions: [active],
        sellerProfile: null,
      },
    ]);
    expect(
      (await app.inject("/fixture")).json<Output>().data[0]!.seller.badge,
    ).toBeNull();
    await app.close();
  });
  it("rejects client tier fields and accepts only bounded account IDs", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = Fastify();
    registerPublicBadges(app, {
      user: { findMany },
    } as unknown as PrismaClient);
    const result = await app.inject({
      method: "POST",
      url: "/verification/badges",
      payload: { accountIds: ["u1"], tier: "BUSINESS" },
    });
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(findMany).not.toHaveBeenCalled();
    await app.close();
  });
});
