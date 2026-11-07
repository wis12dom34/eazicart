import { describe, expect, it } from "vitest";
import { resolveBadge, type Entitlement } from "./entitlement.js";
const now = new Date("2026-11-06T12:00:00Z");
const start = new Date("2026-11-01T00:00:00Z");
const end = new Date("2026-12-01T00:00:00Z");
const pro: Entitlement = {
  status: "ACTIVE",
  planCode: "PRO",
  startsAt: start,
  currentPeriodEnd: end,
  suspendedAt: null,
  payment: { status: "SUCCESS", settledAt: start, planCode: "PRO" },
};
const business: Entitlement = {
  ...pro,
  planCode: "BUSINESS",
  payment: { ...pro.payment!, planCode: "BUSINESS" },
};
describe("server badge entitlement", () => {
  it("requires paid evidence and paid tiers", () => {
    expect(resolveBadge([], null, now)).toBeNull();
    for (const s of [
      { ...pro, planCode: "BASIC" },
      { ...pro, payment: null },
      { ...pro, payment: { ...pro.payment!, status: "FAILED" } },
      { ...pro, status: "PENDING" },
      { ...pro, status: "EXPIRED" },
    ])
      expect(resolveBadge([s], null, now)).toBeNull();
  });
  it("resolves Pro and Business and prioritizes valid Business", () => {
    expect(resolveBadge([pro], null, now)?.variant).toBe("pro");
    expect(resolveBadge([pro, business], null, now)?.variant).toBe("business");
  });
  it("uses inclusive start and exclusive end", () => {
    expect(resolveBadge([pro], null, start)).not.toBeNull();
    expect(resolveBadge([pro], null, end)).toBeNull();
    expect(resolveBadge([{ ...pro, startsAt: end }], null, now)).toBeNull();
  });
  it("retains paid cancelled time and honors both suspension levels", () => {
    expect(
      resolveBadge([{ ...pro, status: "CANCELLED" }], null, now)?.variant,
    ).toBe("pro");
    expect(resolveBadge([pro], start, now)).toBeNull();
    expect(
      resolveBadge([{ ...pro, suspendedAt: start }], null, now),
    ).toBeNull();
  });
  it("ignores newer pending/future records and transitions at effective dates", () => {
    expect(
      resolveBadge([pro, { ...business, status: "PENDING" }], null, now)
        ?.variant,
    ).toBe("pro");
    const upgrade = { ...business, startsAt: new Date("2026-11-10T00:00:00Z") };
    expect(resolveBadge([pro, upgrade], null, now)).toEqual({
      variant: "pro",
      expiresAt: upgrade.startsAt.toISOString(),
    });
    expect(resolveBadge([pro, upgrade], null, upgrade.startsAt)?.variant).toBe(
      "business",
    );
    const downgrade = {
      ...pro,
      startsAt: end,
      currentPeriodEnd: new Date("2027-01-01"),
    };
    expect(resolveBadge([business, downgrade], null, end)?.variant).toBe("pro");
  });
});
