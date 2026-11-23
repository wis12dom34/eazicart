import type { PrismaClient } from "@eazicart/database";
import { resolveBadge } from "../verification/entitlement.js";

export function browserAccountIdentity(db: PrismaClient) {
  return async (ids: string[]) => {
    const now = new Date();
    const subscriptions = {
      where: {
        status: { in: ["ACTIVE", "CANCELLED"] as ("ACTIVE" | "CANCELLED")[] },
        currentPeriodEnd: { gt: now },
      },
      select: {
        status: true,
        planCode: true,
        startsAt: true,
        currentPeriodEnd: true,
        suspendedAt: true,
        payment: {
          select: {
            accountId: true,
            status: true,
            settledAt: true,
            planCode: true,
          },
        },
      },
    };
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        username: true,
        verificationSuspendedAt: true,
        subscriptions,
        sellerProfile: { select: { subscriptions } },
      },
    });
    return new Map(
      users.map((user) => {
        const records = [
          ...user.subscriptions,
          ...(user.sellerProfile?.subscriptions ?? []),
        ].filter((subscription) => subscription.payment?.accountId === user.id);
        return [
          user.id,
          {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            username: user.username,
            badge: resolveBadge(records, user.verificationSuspendedAt, now),
          },
        ];
      }),
    );
  };
}
