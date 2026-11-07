import { randomUUID } from "node:crypto";
import { PrismaClient } from "@eazicart/database";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { PrismaAuthStore } from "../auth/prisma-store.js";
import { activateSubscription, type VerifiedSettlement } from "./settlement.js";

// Explicit disposable database only. Never fall back to DATABASE_URL.
const url = process.env.EAZICART_VERIFICATION_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.pathname !== "/eazicart_badge_test"
  )
    throw new Error(
      "Badge integration tests require a local disposable eazicart_badge_test database",
    );
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
afterAll(async () => {
  await db?.$disconnect();
});
describe.skipIf(!db)("disposable PostgreSQL subscriptions", () => {
  it.each(["account", "seller"])(
    "activates %s subscriptions once, preserves legacy compatibility and refreshes suspension/cancellation state",
    async (owner) => {
      const client = db!;
      const app = buildApp(
        {
          NODE_ENV: "test",
          HOST: "127.0.0.1",
          PORT: 3001,
          DATABASE_URL: url!,
          JWT_SECRET: "isolated-badge-test-secret-32-characters",
          ACCESS_TOKEN_TTL: "15m",
          REFRESH_TOKEN_TTL_DAYS: 30,
          WEB_ORIGIN: "http://localhost:3100",
        },
        { database: client, authStore: new PrismaAuthStore(client) },
      );
      const register = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: `${randomUUID()}@eazicart.invalid`,
          name: "Badge Fixture",
          password: "isolated-test-password",
        },
      });
      expect(register.statusCode).toBe(201);
      const auth = register.json<{
        user: { id: string; email: string };
        tokens: { accessToken: string; refreshToken: string };
      }>();
      const userId = auth.user.id;
      const headers = { authorization: `Bearer ${auth.tokens.accessToken}` };
      const seller =
        owner === "seller"
          ? await client.sellerProfile.create({
              data: { userId, displayName: "Fixture Shop" },
            })
          : null;
      const startsAt = new Date(Date.now() - 1000);
      const currentPeriodEnd = new Date(Date.now() + 3600000);
      const subscription = await client.sellerSubscription.create({
        data: {
          ...(seller ? { sellerId: seller.id } : { accountId: userId }),
          planCode: "PRO",
          status: "ACTIVE",
          startsAt,
          currentPeriodEnd,
        },
      });
      try {
        // A legacy ACTIVE row is not proof of payment.
        expect(
          (await app.inject({ url: "/users/me", headers })).json<{
            badge: unknown;
          }>().badge,
        ).toBeNull();
        await client.sellerSubscription.update({
          where: { id: subscription.id },
          data: { status: "PENDING" },
        });
        const reference = `isolated-sub-${randomUUID()}`;
        await client.subscriptionPayment.create({
          data: {
            subscriptionId: subscription.id,
            accountId: userId,
            provider: "KORAPAY",
            reference,
            planCode: "PRO",
            amountMinor: 250000n,
            currency: "NGN",
          },
        });
        const receipt: VerifiedSettlement = {
          provider: "KORAPAY",
          reference,
          transactionId: randomUUID(),
          accountId: userId,
          subscriptionId: subscription.id,
          planCode: "PRO",
          amountMinor: 250000n,
          currency: "NGN",
          status: "success",
          settledAt: startsAt,
        };
        const address = await client.address.create({
          data: {
            userId,
            line1: "Fixture only",
            city: "Fixture",
            region: "Fixture",
            postalCode: "0000",
            country: "NG",
          },
        });
        const order = await client.order.create({
          data: { userId, addressId: address.id, total: 2500 },
        });
        try {
          await client.payment.create({
            data: {
              provider: "KORAPAY",
              reference,
              amount: 2500,
              currency: "NGN",
              status: "SUCCESS",
              orderId: order.id,
              paidAt: startsAt,
            },
          });
          await expect(activateSubscription(client, receipt)).rejects.toThrow(
            "Order payment cannot settle a subscription",
          );
          expect(
            (
              await client.sellerSubscription.findUniqueOrThrow({
                where: { id: subscription.id },
              })
            ).status,
          ).toBe("PENDING");
          expect(
            (
              await client.subscriptionPayment.findUniqueOrThrow({
                where: { reference },
              })
            ).status,
          ).toBe("PENDING");
        } finally {
          // Remove only this synthetic product-order fixture, never a real transaction.
          await client.order.delete({ where: { id: order.id } });
          await client.address.delete({ where: { id: address.id } });
        }
        const deliveries = await Promise.allSettled([
          activateSubscription(client, receipt),
          activateSubscription(client, receipt),
        ]);
        expect(deliveries.some((r) => r.status === "fulfilled")).toBe(true);
        await activateSubscription(client, receipt); // Serializable retry / duplicate.
        expect(
          (
            await client.sellerSubscription.findUniqueOrThrow({
              where: { id: subscription.id },
            })
          ).currentPeriodEnd,
        ).toEqual(currentPeriodEnd);
        const badge = () =>
          app
            .inject({ url: "/users/me", headers })
            .then((r) => r.json<{ badge: { variant: string } | null }>().badge);
        expect((await badge())?.variant).toBe("pro");
        if (seller) {
          await client.sellerSubscription.create({
            data: {
              sellerId: seller.id,
              planCode: "BUSINESS",
              status: "PENDING",
              startsAt: new Date(Date.now() + 86400000),
              currentPeriodEnd: new Date(Date.now() + 172800000),
            },
          });
          const summary = await app.inject({
            url: "/seller/subscription",
            headers,
          });
          expect(
            summary.json<{ data: { subscription: { id: string } } }>().data
              .subscription.id,
          ).toBe(subscription.id);
        }
        await client.sellerSubscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        expect((await badge())?.variant).toBe("pro");
        await client.user.update({
          where: { id: userId },
          data: { verificationSuspendedAt: new Date() },
        });
        expect(await badge()).toBeNull();
        await client.user.update({
          where: { id: userId },
          data: { verificationSuspendedAt: null },
        });
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          payload: { refreshToken: auth.tokens.refreshToken },
        });
        const login = await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: {
            email: auth.user.email,
            password: "isolated-test-password",
          },
        });
        expect(login.statusCode).toBe(200);
        const signedIn = login.json<{
          tokens: { accessToken: string; refreshToken: string };
        }>();
        const refreshed = await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: signedIn.tokens.refreshToken },
        });
        expect(refreshed.statusCode).toBe(200);
        const renewed = refreshed.json<{ tokens: { accessToken: string } }>();
        const afterRefresh = await app.inject({
          url: "/users/me",
          headers: { authorization: `Bearer ${renewed.tokens.accessToken}` },
        });
        expect(
          afterRefresh.json<{ badge: { variant: string } }>().badge.variant,
        ).toBe("pro");
        expect((await badge())?.variant).toBe("pro");
        await expect(
          activateSubscription(client, {
            ...receipt,
            reference: `order-${randomUUID()}`,
          }),
        ).rejects.toThrow("Unknown subscription payment");
        await expect(
          client.sellerSubscription.create({
            data: {
              accountId: userId,
              sellerId: seller?.id ?? "missing",
              planCode: "PRO",
            },
          }),
        ).rejects.toThrow();
      } finally {
        await app.close();
        await client.subscriptionPayment.deleteMany({
          where: { subscriptionId: subscription.id },
        });
        await client.sellerSubscription.delete({
          where: { id: subscription.id },
        });
        await client.user.delete({ where: { id: userId } });
      }
    },
  );
});
