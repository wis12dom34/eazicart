import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@eazicart/database";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

const runId = randomUUID();
const expectedDb = "eazicart_chat_synthetic";
const url = new URL(
  process.env.DATABASE_URL ?? "postgresql://localhost/no_database",
);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432" ||
  url.pathname !== "/" + expectedDb
) {
  throw new Error(
    "Refusing messaging database tests outside dedicated localhost disposable database",
  );
}
const config: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  DATABASE_URL: url.toString(),
  JWT_SECRET: "chat-test-synthetic-only-not-production-32-chars",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  WEB_ORIGIN: "http://localhost:3000",
};
const db = new PrismaClient();
const app = buildApp(config, { database: db });
const secret = new TextEncoder().encode(config.JWT_SECRET);
const tokenFor = async (id: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
const bearer = (token: string) => ({ authorization: "Bearer " + token });

let buyerToken: string, sellerToken: string, outsiderToken: string;
let buyerId: string,
  sellerId: string,
  outsiderId: string,
  conversationId: string;
const messageKey = "ea2ae48a-82e1-449f-8d13-e359fa35945a";

beforeAll(async () => {
  // This test is hard-locked to the disposable database above.
  // Unique fixture IDs allow safe independent runs against disposable PostgreSQL.
  for (const [key, role] of [
    ["buyer", "BUYER"],
    ["seller", "SELLER"],
    ["outsider", "BUYER"],
  ] as const) {
    const u = await db.user.create({
      data: {
        email: `synthetic-chat-${runId}-${key}@example.invalid`,
        name: key,
        passwordHash: "synthetic-not-real",
        role,
      },
    });
    if (key === "buyer") buyerId = u.id;
    if (key === "seller") sellerId = u.id;
    if (key === "outsider") outsiderId = u.id;
  }
  await db.sellerProfile.create({
    data: { userId: sellerId, displayName: "Synthetic seller" },
  });
  buyerToken = await tokenFor(buyerId);
  sellerToken = await tokenFor(sellerId);
  outsiderToken = await tokenFor(outsiderId);
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe.sequential(
  "buyer/seller messaging contract (isolated disposable PostgreSQL)",
  () => {
    it("rejects unauthenticated list and start attempts", async () => {
      const list = await app.inject({ method: "GET", url: "/conversations" });
      expect(list.statusCode).toBe(401);
      const start = await app.inject({
        method: "POST",
        url: "/conversations",
        payload: { sellerUserId: sellerId },
      });
      expect(start.statusCode).toBe(401);
    });

    it("rejects self-chat, missing sellers, and attempts by outsiders to read messages", async () => {
      const self = await app.inject({
        method: "POST",
        url: "/conversations",
        headers: bearer(sellerToken),
        payload: { sellerUserId: sellerId },
      });
      expect(self.statusCode).toBe(400);
      const missing = await app.inject({
        method: "POST",
        url: "/conversations",
        headers: bearer(buyerToken),
        payload: { sellerUserId: outsiderId },
      });
      expect(missing.statusCode).toBe(404);
    });

    it("creates one conversation per buyer and seller even across retries", async () => {
      const request = () =>
        app.inject({
          method: "POST",
          url: "/conversations",
          headers: bearer(buyerToken),
          payload: { sellerUserId: sellerId },
        });
      const responses = await Promise.all([request(), request()]);
      expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
      const a = responses[0]?.json<{ data: { id: string } }>().data.id;
      const b = responses[1]?.json<{ data: { id: string } }>().data.id;
      expect(a).toBe(b);
      conversationId = a;
      expect(
        await db.conversation.count({ where: { buyerId, sellerId } }),
      ).toBe(1);
    });

    it("only exposes conversations to participants", async () => {
      const buyer = await app.inject({
        method: "GET",
        url: "/conversations",
        headers: bearer(buyerToken),
      });
      const seller = await app.inject({
        method: "GET",
        url: "/conversations",
        headers: bearer(sellerToken),
      });
      const outsider = await app.inject({
        method: "GET",
        url: "/conversations",
        headers: bearer(outsiderToken),
      });
      expect(buyer.json<{ data: unknown[] }>().data).toHaveLength(1);
      expect(seller.json<{ data: unknown[] }>().data).toHaveLength(1);
      expect(outsider.json<{ data: unknown[] }>().data).toHaveLength(0);
      const deniedRead = await app.inject({
        method: "GET",
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(outsiderToken),
      });
      expect(deniedRead.statusCode).toBe(404);
      const deniedWrite = await app.inject({
        method: "POST",
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(outsiderToken),
        payload: { body: "attack", clientMessageId: messageKey },
      });
      expect(deniedWrite.statusCode).toBe(404);
    });

    it("keeps sent messages idempotent and rejects altered replays", async () => {
      const request = (body: string, key: string) =>
        app.inject({
          method: "POST",
          url: `/conversations/${conversationId}/messages`,
          headers: bearer(buyerToken),
          payload: { body, clientMessageId: key },
        });
      const sent = await Promise.all([
        request("Hello", messageKey),
        request("Hello", messageKey),
      ]);
      expect(sent.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(sent[0]?.json<{ data: { id: string } }>().data.id).toBe(
        sent[1]?.json<{ data: { id: string } }>().data.id,
      );
      expect(await db.chatMessage.count({ where: { conversationId } })).toBe(1);
      const altered = await request("Changed message", messageKey);
      expect(altered.statusCode).toBe(409);
      expect(
        (await db.chatMessage.findFirst({ where: { conversationId } }))?.body,
      ).toBe("Hello");
      const empty = await request("  ", "d0203a87-24ab-475d-b542-0173d9018a23");
      expect(empty.statusCode).toBe(400);
      const invalidId = await request("Okay", "not-an-id");
      expect(invalidId.statusCode).toBe(400);
    });

    it("tracks unread messages separately and protects read acknowledgements", async () => {
      const route = `/conversations/${conversationId}/read`;
      const list = (token: string) =>
        app.inject({
          method: "GET",
          url: "/conversations",
          headers: bearer(token),
        });
      const unread = (response: Awaited<ReturnType<typeof list>>) =>
        response.json<{
          data: Array<{ unreadCount: number }>;
          meta: { unreadCount: number };
        }>();
      // Buyer sent first; seller has an unread message.
      expect(unread(await list(sellerToken)).data[0]?.unreadCount).toBe(1);
      expect(unread(await list(buyerToken)).data[0]?.unreadCount).toBe(0);
      const outsider = await app.inject({
        method: "PATCH",
        url: route,
        headers: bearer(outsiderToken),
      });
      expect(outsider.statusCode).toBe(404);
      const anonymous = await app.inject({ method: "PATCH", url: route });
      expect(anonymous.statusCode).toBe(401);
      const marked = await app.inject({
        method: "PATCH",
        url: route,
        headers: bearer(sellerToken),
      });
      expect(marked.statusCode).toBe(200);
      expect(unread(await list(sellerToken)).meta.unreadCount).toBe(0);
      // Repeated reads cannot erase a new message sent later.
      const repeat = await app.inject({
        method: "PATCH",
        url: route,
        headers: bearer(sellerToken),
      });
      expect(repeat.statusCode).toBe(200);
    });

    it("only shares active products owned by the seller in the conversation", async () => {
      const sellerProfile = await db.sellerProfile.findUniqueOrThrow({
        where: { userId: sellerId },
      });
      const category = await db.category.create({
        data: {
          name: "Synthetic chat category " + runId,
          slug: `synthetic-chat-${runId}`,
        },
      });
      const available = await db.product.create({
        data: {
          name: "Synthetic shoes",
          price: "4500",
          stock: 5,
          active: true,
          sellerId: sellerProfile.id,
          categoryId: category.id,
        },
      });
      const otherProfile = await db.sellerProfile.create({
        data: { userId: outsiderId, displayName: "Unrelated seller" },
      });
      const unrelated = await db.product.create({
        data: {
          name: "Unrelated item",
          price: "500",
          stock: 1,
          sellerId: otherProfile.id,
          categoryId: category.id,
        },
      });
      const send = (productId: string, key: string, body = "") =>
        app.inject({
          method: "POST",
          url: `/conversations/${conversationId}/messages`,
          headers: bearer(buyerToken),
          payload: { productId, body, clientMessageId: key },
        });
      const sharedKey = "16ce456b-f03a-47f2-8b92-780c64747877";
      const shared = await send(available.id, sharedKey);
      expect(shared.statusCode).toBe(200);
      expect(
        shared.json<{
          data: { productId: string; product: { name: string } };
        }>().data.product.name,
      ).toBe("Synthetic shoes");
      expect((await send(available.id, sharedKey)).statusCode).toBe(200);
      expect(
        (await send(available.id, sharedKey, "different")).statusCode,
      ).toBe(409);
      expect(
        (await send(unrelated.id, "9df19ba0-4997-4c76-8e36-41f784a1d607"))
          .statusCode,
      ).toBe(404);
      await db.product.update({
        where: { id: available.id },
        data: { active: false },
      });
      // A confirmed message may be safely retried after the product is unpublished.
      expect((await send(available.id, sharedKey)).statusCode).toBe(200);
      expect(
        (await send(available.id, "a94ec153-2a8e-426a-8ad2-9ef195bd2da7"))
          .statusCode,
      ).toBe(404);
      expect(
        (await send("", "ff2bd93b-d3dd-42d4-b426-678f0e87f0f8")).statusCode,
      ).toBe(400);
    });

    it("allows seller replies, blocks unrelated cursors, and pages oldest messages safely", async () => {
      const sellerReply = await app.inject({
        method: "POST",
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(sellerToken),
        payload: {
          body: "Hello, welcome",
          clientMessageId: "e9fd76db-98a4-4970-9dfd-c4047930554e",
        },
      });
      expect(sellerReply.statusCode).toBe(200);
      const listing = await app.inject({
        method: "GET",
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(buyerToken),
      });
      expect(listing.statusCode).toBe(200);
      const data = listing.json<{
        data: Array<{ senderId: string; body: string }>;
        pagination: { hasMore: boolean };
      }>();
      expect(data.data).toHaveLength(3);
      expect(data.data.map((m) => m.body)).toContain("Hello, welcome");
      expect(data.data.map((m) => m.senderId)).toContain(sellerId);
      expect(data.pagination.hasMore).toBe(false);
      const invalid = await app.inject({
        method: "GET",
        url: `/conversations/${conversationId}/messages?cursor=unrelated`,
        headers: bearer(buyerToken),
      });
      expect(invalid.statusCode).toBe(400);
    });

    it("blocks new messages for both parties and prevents outsider toggles", async () => {
      const route = `/conversations/${conversationId}/block`;
      const toggle = (token: string, blocked: boolean) =>
        app.inject({
          method: "PATCH",
          url: route,
          headers: bearer(token),
          payload: { blocked },
        });
      const send = (token: string) =>
        app.inject({
          method: "POST",
          url: `/conversations/${conversationId}/messages`,
          headers: bearer(token),
          payload: { body: "Should not send", clientMessageId: randomUUID() },
        });
      expect((await toggle(outsiderToken, true)).statusCode).toBe(404);
      expect((await toggle(buyerToken, true)).statusCode).toBe(200);
      const previouslyAccepted = await app.inject({
        method: "POST",
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(buyerToken),
        payload: { body: "Hello", clientMessageId: messageKey },
      });
      expect(previouslyAccepted.statusCode).toBe(200);
      expect((await send(buyerToken)).statusCode).toBe(403);
      expect((await send(sellerToken)).statusCode).toBe(403);
      const inbox = await app.inject({
        method: "GET",
        url: "/conversations",
        headers: bearer(buyerToken),
      });
      expect(
        inbox.json<{ data: Array<{ buyerBlockedAt: string | null }> }>().data[0]
          ?.buyerBlockedAt,
      ).toBeTruthy();
      expect((await toggle(buyerToken, false)).statusCode).toBe(200);
      expect((await send(sellerToken)).statusCode).toBe(200);
      expect((await toggle(sellerToken, true)).statusCode).toBe(200);
      expect((await send(buyerToken)).statusCode).toBe(403);
      expect((await toggle(sellerToken, false)).statusCode).toBe(200);
      expect((await toggle(outsiderToken, false)).statusCode).toBe(404);
    });

    it("records participant reports privately without creating duplicates", async () => {
      const route = `/conversations/${conversationId}/report`;
      const report = (
        token: string,
        payload: { reason: string; details?: string },
      ) =>
        app.inject({
          method: "POST",
          url: route,
          headers: bearer(token),
          payload,
        });
      const first = await report(buyerToken, {
        reason: "SCAM",
        details: "Synthetic suspicious claim",
      });
      expect(first.statusCode).toBe(200);
      expect(first.json<{ data: { recorded: boolean } }>().data.recorded).toBe(
        true,
      );
      const second = await report(buyerToken, {
        reason: "SCAM",
        details: "Synthetic suspicious claim",
      });
      expect(second.statusCode).toBe(200);
      expect(first.json<{ data: { id: string } }>().data.id).toBe(
        second.json<{ data: { id: string } }>().data.id,
      );
      expect((await report(buyerToken, { reason: "SPAM" })).statusCode).toBe(
        409,
      );
      expect((await report(outsiderToken, { reason: "SPAM" })).statusCode).toBe(
        404,
      );
      expect((await report(sellerToken, { reason: "SPAM" })).statusCode).toBe(
        200,
      );
      expect(
        (await report(sellerToken, { reason: "NOT_VALID" })).statusCode,
      ).toBe(400);
      expect(
        (
          await report(sellerToken, {
            reason: "SPAM",
            details: "X".repeat(1001),
          })
        ).statusCode,
      ).toBe(400);
      const anonymous = await app.inject({
        method: "POST",
        url: route,
        payload: { reason: "SPAM" },
      });
      expect(anonymous.statusCode).toBe(401);
      expect(await db.chatReport.count({ where: { conversationId } })).toBe(2);
      const listing = await app.inject({
        method: "GET",
        url: "/conversations",
        headers: bearer(buyerToken),
      });
      expect(listing.body).not.toContain("Synthetic suspicious claim");
      expect(listing.body).not.toContain("chatReports");
    });

    it("caps new sends across simultaneous requests without blocking confirmed retries", async () => {
      const route = `/conversations/${conversationId}/messages`;
      const send = (token: string, key: string) =>
        app.inject({
          method: "POST",
          url: route,
          headers: bearer(token),
          payload: { body: "Controlled test message", clientMessageId: key },
        });
      const baseline = await db.chatMessage.count({
        where: {
          senderId: buyerId,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      });
      expect(baseline).toBeLessThan(20);
      for (let i = baseline; i < 19; i++) {
        const response = await send(buyerToken, randomUUID());
        expect(response.statusCode).toBe(200);
      }
      const candidates = await Promise.all(
        Array.from({ length: 4 }, () => send(buyerToken, randomUUID())),
      );
      expect(candidates.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(candidates.filter((r) => r.statusCode === 429)).toHaveLength(3);
      const replay = await app.inject({
        method: "POST",
        url: route,
        headers: bearer(buyerToken),
        payload: { body: "Hello", clientMessageId: messageKey },
      });
      expect(replay.statusCode).toBe(200);
      const seller = await send(sellerToken, randomUUID());
      expect(seller.statusCode).toBe(200);
      const buyerCount = await db.chatMessage.count({
        where: {
          senderId: buyerId,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      });
      expect(buyerCount).toBe(20);
    });
  },
);
