export type Badge = { variant: "pro" | "business"; expiresAt: string };
export type Entitlement = {
  status: string;
  planCode: string;
  startsAt: Date | null;
  currentPeriodEnd: Date | null;
  suspendedAt: Date | null;
  payment: { status: string; settledAt: Date | null; planCode: string } | null;
};

/** Only trusted persisted settlement evidence counts. End boundaries are exclusive. */
export function resolveBadge(
  records: readonly Entitlement[],
  suspendedAt: Date | null,
  now = new Date(),
): Badge | null {
  if (suspendedAt) return null;
  const valid = records.filter(
    (s) =>
      ["ACTIVE", "CANCELLED"].includes(s.status) &&
      ["PRO", "BUSINESS"].includes(s.planCode) &&
      !s.suspendedAt &&
      s.startsAt &&
      s.currentPeriodEnd &&
      s.startsAt <= now &&
      now < s.currentPeriodEnd &&
      s.payment?.status === "SUCCESS" &&
      s.payment.settledAt &&
      s.payment.settledAt <= now &&
      s.payment.planCode === s.planCode,
  );
  const business = valid.filter((s) => s.planCode === "BUSINESS");
  const winning = business.length ? business : valid;
  if (!winning.length) return null;
  // Re-evaluate at the next relevant boundary, including scheduled upgrades.
  const boundaries = records
    .flatMap((s) => [s.startsAt, s.currentPeriodEnd])
    .filter((d): d is Date => !!d && d > now);
  return {
    variant: business.length ? "business" : "pro",
    expiresAt: new Date(Math.min(...boundaries.map(Number))).toISOString(),
  };
}
