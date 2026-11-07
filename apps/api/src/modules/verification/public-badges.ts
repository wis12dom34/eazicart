import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveBadge } from "./entitlement.js";

type Node = Record<string, unknown>;
/** Decorate existing account DTOs with one batched lookup per response, never per post.
 * This walks server-created output only; input bodies are never inspected.
 */
export function registerPublicBadges(app: FastifyInstance, db?: PrismaClient) {
  app.post("/verification/badges", async (request, reply) => {
    const { accountIds } = z
      .object({ accountIds: z.array(z.string().min(1).max(100)).max(1000) })
      .strict()
      .parse(request.body);
    reply.header("Cache-Control", "private, no-store");
    if (!db) return { data: {} };
    return { data: Object.fromEntries(await loadBadges(db, accountIds)) };
  });
  app.addHook("preSerialization", async (request, reply, payload) => {
    if (!db || reply.statusCode >= 400) return payload;
    const accounts: { node: Node; id: string }[] = [];
    const visit = (value: unknown, key = "") => {
      if (Array.isArray(value)) {
        value.forEach((v) => visit(v, key));
        return;
      }
      if (!value || typeof value !== "object" || value instanceof Date) return;
      const node = value as Node;
      // SellerProfile DTOs are identified by their explicit public identity fields.
      if (
        typeof node.displayName === "string" &&
        typeof node.userId === "string"
      ) {
        accounts.push({ node, id: node.userId });
      } else if (
        typeof node.id === "string" &&
        typeof node.name === "string" &&
        (["user", "customer", "follower", "seller"].includes(key) ||
          (["/users/me", "/seller/customers"].includes(
            request.routeOptions.url ?? "",
          ) &&
            ["", "data"].includes(key)))
      ) {
        accounts.push({ node, id: node.id });
      }
      for (const [k, v] of Object.entries(node)) if (k !== "badge") visit(v, k);
    };
    visit(payload);
    if (!accounts.length) return payload;
    const ids = [...new Set(accounts.map((a) => a.id))];
    const badges = await loadBadges(db, ids);
    accounts.forEach(({ node, id }) => {
      node.badge = badges.get(id) ?? null;
    });
    // No CDN/browser retention after activation, suspension or a period boundary.
    reply.header("Cache-Control", "private, no-store");
    return payload;
  });
}

async function loadBadges(db: PrismaClient, ids: string[]) {
  const now = new Date();
  const subscriptions = {
    where: {
      status: { in: ["ACTIVE", "CANCELLED"] as ("ACTIVE" | "CANCELLED")[] },
      currentPeriodEnd: { gt: now },
      suspendedAt: null,
    },
    select: {
      status: true,
      planCode: true,
      startsAt: true,
      currentPeriodEnd: true,
      suspendedAt: true,
      payment: { select: { status: true, settledAt: true, planCode: true } },
    },
  } as const;
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: {
      id: true,
      verificationSuspendedAt: true,
      subscriptions,
      sellerProfile: { select: { subscriptions } },
    },
  });
  return new Map(
    users.map((u) => [
      u.id,
      resolveBadge(
        [...u.subscriptions, ...(u.sellerProfile?.subscriptions ?? [])],
        u.verificationSuspendedAt,
        now,
      ),
    ]),
  );
}
