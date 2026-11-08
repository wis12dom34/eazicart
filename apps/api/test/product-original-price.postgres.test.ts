import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@eazicart/database";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/unset");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/eazicart_discount_synthetic"
) {
  throw new Error(
    "Product price tests only run on the dedicated disposable PostgreSQL database.",
  );
}
const runId = randomUUID();
const config: AppConfig = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3001,
  DATABASE_URL: url.toString(),
  JWT_SECRET: "product-discount-test-only-not-production-32-chars",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  WEB_ORIGIN: "http://localhost:3000",
};
const db = new PrismaClient();
const app = buildApp(config, { database: db });
const secret = new TextEncoder().encode(config.JWT_SECRET);
const tokenFor = async (uid: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
const auth = (token: string) => ({ authorization: "Bearer " + token });
let sellerToken = "";
let buyerToken = "";
let categoryId = "";
let productId = "";
beforeAll(async () => {
  const buyer = await db.user.create({
    data: {
      name: "Synthetic buyer",
      email: `discount-buyer-${runId}@example.invalid`,
      passwordHash: "not-real",
      role: "BUYER",
    },
  });
  const seller = await db.user.create({
    data: {
      name: "Synthetic seller",
      email: `discount-seller-${runId}@example.invalid`,
      passwordHash: "not-real",
      role: "SELLER",
      sellerProfile: { create: { displayName: "Synthetic store " + runId } },
    },
  });
  const category = await db.category.create({
    data: {
      name: "Synthetic category " + runId,
      slug: "synthetic-discount-" + runId,
    },
  });
  categoryId = category.id;
  [sellerToken, buyerToken] = await Promise.all([
    tokenFor(seller.id),
    tokenFor(buyer.id),
  ]);
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});
describe.sequential(
  "original price and selling price (disposable PostgreSQL)",
  () => {
    const product = (originalPrice: string | null) => ({
      name: "Synthetic running shoes",
      description: "A synthetic test product",
      price: "4500.00",
      stock: 20,
      categoryId,
      originalPrice,
    });

    it("rejects unauthenticated writes and original price at/below selling price", async () => {
      const unsigned = await app.inject({
        method: "POST",
        url: "/products",
        payload: product("6000.00"),
      });
      expect(unsigned.statusCode).toBe(401);
      for (const invalidPrice of ["4500.00", "4000.00"]) {
        const response = await app.inject({
          method: "POST",
          url: "/products",
          headers: auth(sellerToken),
          payload: product(invalidPrice),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json<{ error: { code: string } }>().error.code).toBe(
          "INVALID_DISCOUNT_PRICE",
        );
      }
    });
    it("creates discounted product and returns consistent original and discount metadata", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/products",
        headers: auth(sellerToken),
        payload: product("6000.00"),
      });
      expect(response.statusCode).toBe(201);
      const saved = response.json<{
        data: {
          id: string;
          price: string;
          originalPrice: string;
          discountPercent: number;
        };
      }>().data;
      productId = saved.id;
      expect(saved.price).toBe("4500");
      expect(saved.originalPrice).toBe("6000");
      expect(saved.discountPercent).toBe(25);
      const view = await app.inject({
        method: "GET",
        url: "/products/" + productId,
      });
      expect(view.statusCode).toBe(200);
      expect(
        view.json<{ data: { discountPercent: number } }>().data.discountPercent,
      ).toBe(25);
    });
    it("charges selling price only in cart, not crossed-out price", async () => {
      const added = await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: auth(buyerToken),
        payload: { productId, quantity: 2 },
      });
      expect(added.statusCode).toBe(201);
      const cart = added.json<{
        data: {
          total: string;
          items: Array<{
            unitPrice: string;
            product: { price: string };
          }>;
        };
      }>().data;
      expect(cart.total).toBe("9000");
      expect(cart.items[0]?.unitPrice).toBe("4500");
      expect(cart.items[0]?.product.price).toBe("4500");
    });
    it("rejects edited selling price that violates existing original price", async () => {
      const result = await app.inject({
        method: "PATCH",
        url: "/products/" + productId,
        headers: auth(sellerToken),
        payload: { price: "6500.00" },
      });
      expect(result.statusCode).toBe(400);
      expect(result.json<{ error: { code: string } }>().error.code).toBe(
        "INVALID_DISCOUNT_PRICE",
      );
    });
    it("prevents other sellers from editing and permits discount removal", async () => {
      const other = await app.inject({
        method: "PATCH",
        url: "/products/" + productId,
        headers: auth(buyerToken),
        payload: { originalPrice: null },
      });
      expect(other.statusCode).toBe(403);
      const removed = await app.inject({
        method: "PATCH",
        url: "/products/" + productId,
        headers: auth(sellerToken),
        payload: { originalPrice: null },
      });
      expect(removed.statusCode).toBe(200);
      const updated = removed.json<{
        data: {
          price: string;
          originalPrice: string | null;
          discountPercent: number | null;
        };
      }>().data;
      expect(updated.price).toBe("4500");
      expect(updated.originalPrice).toBeNull();
      expect(updated.discountPercent).toBeNull();
    });
  },
);
