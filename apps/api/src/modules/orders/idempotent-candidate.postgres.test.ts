import Fastify from "fastify";
import { PrismaClient } from "@eazicart/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError } from "../../errors.js";
import { registerIsolatedIdempotentOrderCandidate } from "./idempotent-candidate.js";

const disposable =
  process.env.EAZICART_DISPOSABLE_ORDER_TEST === "1" &&
  process.env.PGPORT !== "5432" &&
  Number(process.env.PGPORT) >= 1024 &&
  (() => {
    try {
      const url = new URL(process.env.DATABASE_URL ?? "");
      return (
        url.protocol === "postgresql:" &&
        url.hostname === "localhost" &&
        url.port === process.env.PGPORT &&
        url.pathname === "/postgres" &&
        url.searchParams.get("schema") === "public" &&
        url.username === "postgres" &&
        Boolean(process.env.PGPASSWORD) &&
        url.password === process.env.PGPASSWORD
      );
    } catch {
      return false;
    }
  })();

const run = disposable ? describe : describe.skip;
run("Native order idempotency (temporary isolated PostgreSQL only)", () => {
  const db = new PrismaClient();
  const app = Fastify({ logger: false });
  const seller = "idp-fixture-seller";
  const profile = "idp-fixture-store";
  const category = "idp-fixture-category";
  const prefix = "native-idempotency-fixture-";
  const submit = (
    buyerId: string,
    addressId: string,
    key: string,
    expectedTotal = "1250.00",
  ) =>
    app.inject({
      method: "POST",
      url: "/preview/orders/idempotent",
      headers: { authorization: `Bearer ${buyerId}` },
      payload: { addressId, idempotencyKey: key, expectedTotal },
    });

  const fixture = async (name: string, stock = 5) => {
    const buyerId = prefix + name;
    const addressId = prefix + "address-" + name;
    const productId = prefix + "product-" + name;
    const cartId = prefix + "cart-" + name;
    await db.user.create({
      data: {
        id: buyerId,
        email: `${name}@idp.example.test`,
        passwordHash: "fixture-not-real",
        name: "Idempotency buyer",
      },
    });
    await db.address.create({
      data: {
        id: addressId,
        userId: buyerId,
        line1: "Fixture Road",
        city: "Warri",
        region: "Delta",
        postalCode: "332001",
        country: "NG",
      },
    });
    await db.product.create({
      data: {
        id: productId,
        name: "Fixture trainers",
        price: "1250",
        stock,
        sellerId: profile,
        categoryId: category,
      },
    });
    await db.cart.create({
      data: {
        id: cartId,
        userId: buyerId,
        items: { create: { productId, quantity: 1 } },
      },
    });
    return { buyerId, addressId, productId, cartId };
  };
  beforeAll(async () => {
    await db.user.create({
      data: {
        id: seller,
        email: "idp-store@example.test",
        passwordHash: "fixture-not-real",
        name: "Idp store",
      },
    });
    await db.sellerProfile.create({
      data: {
        id: profile,
        userId: seller,
        displayName: "Fixture store",
      },
    });
    await db.category.create({
      data: {
        id: category,
        slug: category,
        name: "Fixture category",
      },
    });
    app.decorate("authenticate", (request) => {
      const buyerId = request.headers.authorization?.replace(/^Bearer /, "");
      if (!buyerId || !buyerId.startsWith(prefix)) {
        throw new AppError(
          401,
          "UNAUTHORIZED",
          "Fixture authentication required",
        );
      }
      request.userId = buyerId;
      return Promise.resolve();
    });
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof AppError) {
        return reply
          .code(error.statusCode)
          .send({ error: { code: error.code }, requestId: request.id });
      }
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: { code: "VALIDATION_ERROR" } });
      }
      return reply.code(500).send({
        error: {
          code: "INTERNAL_ERROR",
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    });
    registerIsolatedIdempotentOrderCandidate(app, db);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it("rejects unauthenticated order requests without any order", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/preview/orders/idempotent",
      payload: {
        addressId: "address",
        expectedTotal: "1250",
        idempotencyKey: "fixture-12345678901234",
      },
    });
    expect(reply.statusCode).toBe(401);
  });

  it("returns the same committed order on retries, even after the cart is emptied", async () => {
    const f = await fixture("retry");
    const key = "idempotency-fixture-retry-01";
    const first = await submit(f.buyerId, f.addressId, key);
    expect(first.statusCode, first.body).toBe(201);
    const second = await submit(f.buyerId, f.addressId, key);
    expect(second.statusCode, second.body).toBe(200);
    const firstOrder = first.json<{
      data: { id: string };
      replayed: boolean;
    }>();
    expect(firstOrder.replayed).toBe(false);
    expect(second.json()).toMatchObject({
      data: { id: firstOrder.data.id },
      replayed: true,
    });
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
    expect(await db.cartItem.count({ where: { cartId: f.cartId } })).toBe(0);
    expect(
      await db.notification.count({
        where: { userId: f.buyerId, title: "Order received" },
      }),
    ).toBe(1);
    expect(
      await db.payment.count({ where: { orderId: firstOrder.data.id } }),
    ).toBe(0);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(5);
  });

  it("concurrent duplicate keys yield one order, notification and durable idempotency record", async () => {
    const f = await fixture("concurrent-same");
    const key = "idempotency-fixture-parallel-01";
    const replies = await Promise.all(
      Array.from({ length: 7 }, () => submit(f.buyerId, f.addressId, key)),
    );
    expect(
      replies.map((r) => r.statusCode),
      JSON.stringify(replies.map((r) => r.body)),
    ).toEqual(expect.arrayContaining([201, 200, 200]));
    expect(
      replies.every((r) => [200, 201].includes(r.statusCode)),
      JSON.stringify(replies.map((r) => r.body)),
    ).toBe(true);
    const ids = replies.map((r) => r.json<{ data: { id: string } }>().data.id);
    expect(new Set(ids).size).toBe(1);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
    expect(
      await db.orderIdempotency.count({ where: { buyerId: f.buyerId } }),
    ).toBe(1);
    expect(
      await db.notification.count({
        where: { userId: f.buyerId, title: "Order received" },
      }),
    ).toBe(1);
  });

  it("different keys for one cart cannot create duplicate orders concurrently", async () => {
    const f = await fixture("concurrent-different");
    const keys = [
      "idempotency-fixture-distinct-01",
      "idempotency-fixture-distinct-02",
      "idempotency-fixture-distinct-03",
    ];
    const replies = await Promise.all(
      keys.map((k) => submit(f.buyerId, f.addressId, k)),
    );
    expect(
      replies.filter((r) => r.statusCode === 201).length,
      JSON.stringify(replies.map((r) => r.body)),
    ).toBe(1);
    expect(
      replies
        .filter((r) => r.statusCode !== 201)
        .every((r) => r.statusCode === 400),
    ).toBe(true);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
    expect(await db.cartItem.count({ where: { cartId: f.cartId } })).toBe(0);
  });

  it("allows two different buyers to use the same key without mixing orders", async () => {
    const a = await fixture("shared-key-a");
    const b = await fixture("shared-key-b");
    const key = "idempotency-fixture-shared-key-01";
    const [responseA, responseB] = await Promise.all([
      submit(a.buyerId, a.addressId, key),
      submit(b.buyerId, b.addressId, key),
    ]);
    expect(responseA.statusCode, responseA.body).toBe(201);
    expect(responseB.statusCode, responseB.body).toBe(201);
    expect(responseA.json<{ data: { id: string } }>().data.id).not.toBe(
      responseB.json<{ data: { id: string } }>().data.id,
    );
    expect(await db.orderIdempotency.count({ where: { key } })).toBe(2);
  });

  it("persists the replay key across a new Prisma client connection", async () => {
    const f = await fixture("new-process");
    const key = "idempotency-fixture-new-process-01";
    const first = await submit(f.buyerId, f.addressId, key);
    expect(first.statusCode, first.body).toBe(201);
    const separateConnection = new PrismaClient();
    try {
      const { createIdempotentOrderCandidate } =
        await import("./idempotent-candidate.js");
      const replay = await createIdempotentOrderCandidate(
        separateConnection,
        f.buyerId,
        {
          addressId: f.addressId,
          expectedTotal: "1250.00",
          idempotencyKey: key,
        },
      );
      expect(replay.replayed).toBe(true);
      expect(replay.data.id).toBe(
        first.json<{ data: { id: string } }>().data.id,
      );
      expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
    } finally {
      await separateConnection.$disconnect();
    }
  });

  it("rejects a changed address or total on the same key", async () => {
    const f = await fixture("conflict");
    const key = "idempotency-fixture-conflict-01";
    const address2 = prefix + "alternate-address-conflict";
    await db.address.create({
      data: {
        id: address2,
        userId: f.buyerId,
        line1: "Different street",
        city: "Warri",
        region: "Delta",
        postalCode: "332001",
        country: "NG",
      },
    });
    expect((await submit(f.buyerId, f.addressId, key)).statusCode).toBe(201);
    const changedAddress = await submit(f.buyerId, address2, key);
    expect(changedAddress.statusCode).toBe(409);
    expect(changedAddress.json()).toMatchObject({
      error: { code: "IDEMPOTENCY_CONFLICT" },
    });
    expect(
      (await submit(f.buyerId, f.addressId, key, "1300.00")).statusCode,
    ).toBe(409);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
  });

  it("rejects foreign addresses before order creation", async () => {
    const f = await fixture("owner");
    const other = await fixture("address-owner");
    const reply = await submit(
      f.buyerId,
      other.addressId,
      "idempotency-fixture-foreign-address",
    );
    expect(reply.statusCode).toBe(404);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: f.cartId } })).toBe(1);
  });

  it("rejects changed cart totals and insufficient stock with no side effects", async () => {
    const f = await fixture("price");
    const wrongTotal = await submit(
      f.buyerId,
      f.addressId,
      "idempotency-fixture-wrong-total",
      "1200",
    );
    expect(wrongTotal.statusCode).toBe(409);
    expect(wrongTotal.json()).toMatchObject({
      error: { code: "CART_TOTAL_CHANGED" },
    });
    await db.product.update({ where: { id: f.productId }, data: { stock: 0 } });
    const unavailable = await submit(
      f.buyerId,
      f.addressId,
      "idempotency-fixture-empty-stock",
    );
    expect(unavailable.statusCode).toBe(409);
    expect(await db.cartItem.count({ where: { cartId: f.cartId } })).toBe(1);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(0);
  });

  it("rolls back created order, notification and cart deletion on transaction failure", async () => {
    const f = await fixture("rollback");
    const triggerName = "idp_test_reject_notification";
    // Trigger is created ONLY in pg_virtualenv disposable DB.
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION ${triggerName}() RETURNS trigger AS $$
      BEGIN
        IF NEW."userId" = '${f.buyerId}' THEN
          RAISE EXCEPTION 'fixture notification write rejected';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`CREATE TRIGGER ${triggerName}_trigger BEFORE INSERT ON "Notification"
      FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`);
    const key = "idempotency-fixture-rollback-01";
    try {
      const failure = await submit(f.buyerId, f.addressId, key);
      expect(failure.statusCode).toBe(500);
      expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(0);
      expect(
        await db.orderIdempotency.count({ where: { buyerId: f.buyerId } }),
      ).toBe(0);
      expect(await db.cartItem.count({ where: { cartId: f.cartId } })).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS ${triggerName}_trigger ON "Notification"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${triggerName}()`);
    }
    const retry = await submit(f.buyerId, f.addressId, key);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(await db.order.count({ where: { userId: f.buyerId } })).toBe(1);
  });
});
