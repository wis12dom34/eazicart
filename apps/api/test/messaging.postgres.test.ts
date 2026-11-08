import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@eazicart/database";
import { SignJWT } from "jose";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

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
  // Clearing only its synthetic test accounts permits safe reruns.
  await db.user.deleteMany({
    where: { email: { startsWith: "synthetic-chat-" } },
  });
  for (const [key, role] of [
    ["buyer", "BUYER"],
    ["seller", "SELLER"],
    ["outsider", "BUYER"],
  ] as const) {
    const u = await db.user.create({
      data: {
        email: `synthetic-chat-${key}@example.invalid`,
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
      expect(data.data).toHaveLength(2);
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
  },
);
