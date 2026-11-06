import { PrismaClient } from "@eazicart/database";
import Fastify from "fastify";
import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError } from "../../errors.js";
import { registerIdempotentOrderPreview } from "./idempotent-preview.js";

/**
 * Opt-in only, against an ephemeral pg_virtualenv cluster. This suite NEVER
 * opens a production connection or processes real payments.
 */
const env = process.env;
const url = (() => {
  try {
    return new URL(env.DATABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const disposable =
  env.EAZICART_IDEM_DISPOSABLE === "1" &&
  env.NODE_ENV === "test" &&
  Boolean(url) &&
  url?.protocol === "postgresql:" &&
  url?.username === "root" &&
  url?.hostname === "localhost" &&
  url?.pathname === "/postgres" &&
  url?.searchParams.get("schema") === "public" &&
  Number(env.PGPORT) >= 1024 &&
  Number(env.PGPORT) !== 5432 &&
  url?.port === env.PGPORT &&
  !url?.password;
type IdempotentApiResponse = {
  data: { id: string; total: string };
  replayed: boolean;
  error: { code: string };
};
const run = disposable ? describe : describe.skip;

run("Idempotent order creation against disposable PostgreSQL", () => {
  const db = new PrismaClient();
  const buyer1 = "idempotency-fixture-buyer-1";
  const buyer2 = "idempotency-fixture-buyer-2";
  const sellerUser = "idempotency-fixture-seller";
  const profile = "idempotency-fixture-profile";
  const category = "idempotency-fixture-category";
  const addr1 = "idempotency-fixture-address-1";
  const addr2 = "idempotency-fixture-address-2";
  const app = Fastify();
  const path = "/preview/orders/idempotent";
  const latestProducts = new Map<string, { id: string; price: string }>();
  let counter = 0;
  const newKey = () =>
    "isolated-idempotency-" + (++counter).toString().padStart(16, "0");
  const body = (addressId = addr1, expectedTotal = "1250.00") => {
    const buyerId = addressId === addr2 ? buyer2 : buyer1;
    const product = latestProducts.get(buyerId) ?? latestProducts.get(buyer1);
    return {
      addressId,
      expectedTotal,
      cartSnapshot: [
        {
          productId: product?.id ?? "unavailable",
          quantity: 1,
          unitPrice: product?.price ?? "1250.00",
        },
      ],
    };
  };
  const send = (key: string, payload = body(), who = buyer1) =>
    app.inject({
      method: "POST",
      url: path,
      headers: { authorization: "Bearer " + who, "idempotency-key": key },
      payload,
    });
  const countForKey = (key: string, buyerId = buyer1) =>
    db.orderIdempotency.count({ where: { buyerId, key } });

  async function seedCart(suffix: string, buyerId = buyer1, price = "1250.00") {
    const id = "idempotent-product-" + suffix;
    await db.product.create({
      data: {
        id,
        name: "Fixture trainers " + suffix,
        stock: 5,
        price,
        active: true,
        sellerId: profile,
        categoryId: category,
      },
    });
    const cart = await db.cart.upsert({
      where: { userId: buyerId },
      create: { id: "idempotent-cart-" + buyerId, userId: buyerId },
      update: {},
    });
    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
    await db.cartItem.create({
      data: {
        id: "idempotent-cart-item-" + suffix,
        cartId: cart.id,
        productId: id,
        quantity: 1,
      },
    });
    latestProducts.set(buyerId, { id, price });
    return { productId: id, cartId: cart.id };
  }

  beforeAll(async () => {
    // Check the actual server data directory before any fixture INSERT.
    const result = await db.$queryRawUnsafe<Array<{ data_directory: string }>>(
      "SELECT current_setting('data_directory') AS data_directory",
    );
    const dir = result[0]?.data_directory;
    if (!dir?.startsWith("/tmp/pg_virtualenv.")) {
      throw new Error("Refusing non-disposable PostgreSQL server");
    }
    await db.user.createMany({
      data: [
        {
          id: buyer1,
          name: "Fixture buyer",
          email: "idem-1@example.test",
          passwordHash: "fixture",
        },
        {
          id: buyer2,
          name: "Fixture buyer 2",
          email: "idem-2@example.test",
          passwordHash: "fixture",
        },
        {
          id: sellerUser,
          name: "Fixture seller",
          email: "idem-seller@example.test",
          passwordHash: "fixture",
        },
      ],
    });
    await db.sellerProfile.create({
      data: { id: profile, userId: sellerUser, displayName: "Fixture Store" },
    });
    await db.category.create({
      data: {
        id: category,
        name: "Fixture Category",
        slug: "idempotency-fixture-category",
      },
    });
    await db.address.createMany({
      data: [
        {
          id: addr1,
          userId: buyer1,
          line1: "Fixture Road",
          city: "Fixture",
          region: "Fixture",
          postalCode: "00001",
          country: "NG",
        },
        {
          id: addr2,
          userId: buyer2,
          line1: "Fixture Road 2",
          city: "Fixture",
          region: "Fixture",
          postalCode: "00002",
          country: "NG",
        },
      ],
    });
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof AppError)
        return reply
          .code(error.statusCode)
          .send({ error: { code: error.code }, requestId: request.id });
      if (error instanceof ZodError)
        return reply
          .code(400)
          .send({ error: { code: "VALIDATION_ERROR" }, requestId: request.id });
      request.log.error(error);
      return reply
        .code(500)
        .send({ error: { code: "INTERNAL_ERROR" }, requestId: request.id });
    });
    app.decorate("authenticate", (request) => {
      const id = request.headers.authorization?.replace(/^Bearer /, "");
      if (id !== buyer1 && id !== buyer2)
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      request.userId = id;
      return Promise.resolve();
    });
    registerIdempotentOrderPreview(app, db);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it("blocks missing auth and key without creating orders", async () => {
    await seedCart("auth");
    const key = newKey();
    const badAuth = await app.inject({
      method: "POST",
      url: path,
      payload: body(),
      headers: { "idempotency-key": key },
    });
    expect(badAuth.statusCode).toBe(401);
    const badKey = await app.inject({
      method: "POST",
      url: path,
      payload: body(),
      headers: { authorization: "Bearer " + buyer1 },
    });
    expect(badKey.statusCode).toBe(400);
    expect(await countForKey(key)).toBe(0);
  });

  it("creates one order, clears cart and creates one notification", async () => {
    const fixture = await seedCart("single");
    const key = newKey();
    const response = await send(key);
    expect(response.statusCode).toBe(201);
    expect(response.json<IdempotentApiResponse>().replayed).toBe(false);
    expect(response.json<IdempotentApiResponse>().data.total).toBe("1250");
    expect(await countForKey(key)).toBe(1);
    expect(
      await db.order.count({
        where: { userId: buyer1, idempotencyRecord: { is: { key } } },
      }),
    ).toBe(1);
    expect(await db.cartItem.count({ where: { cartId: fixture.cartId } })).toBe(
      0,
    );
    expect(
      await db.notification.count({
        where: { userId: buyer1, title: "Order received" },
      }),
    ).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stock,
    ).toBe(5);
    expect(
      await db.payment.count({
        where: { orderId: response.json<IdempotentApiResponse>().data.id },
      }),
    ).toBe(0);
  });

  it("replays same order after cart is already cleared, without a second notification", async () => {
    await seedCart("replay");
    const key = newKey();
    const first = await send(key);
    const before = await db.notification.count({
      where: { userId: buyer1, title: "Order received" },
    });
    const retry = await send(key);
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);
    expect(retry.json<IdempotentApiResponse>().data.id).toBe(
      first.json<IdempotentApiResponse>().data.id,
    );
    expect(retry.json<IdempotentApiResponse>().replayed).toBe(true);
    expect(
      await db.notification.count({
        where: { userId: buyer1, title: "Order received" },
      }),
    ).toBe(before);
  });

  it("rejects same key with changed price, address or payload", async () => {
    await seedCart("fingerprint");
    const key = newKey();
    const first = await send(key);
    expect(first.statusCode).toBe(201);
    const price = await send(key, body(addr1, "1250.01"));
    const address = await send(key, { ...body(addr1), addressId: addr2 });
    expect(price.statusCode).toBe(409);
    expect(address.statusCode).toBe(409);
    expect(price.json<IdempotentApiResponse>().error.code).toBe(
      "IDEMPOTENCY_KEY_REUSED",
    );
    expect(await countForKey(key)).toBe(1);
  });

  it("rolls back key claim for missing address and changed total", async () => {
    await seedCart("rollback");
    const wrongAddressKey = newKey();
    expect((await send(wrongAddressKey, body(addr2))).statusCode).toBe(404);
    expect(await countForKey(wrongAddressKey)).toBe(0);
    const wrongTotalKey = newKey();
    const price = await send(wrongTotalKey, body(addr1, "800.00"));
    expect(price.statusCode).toBe(409);
    expect(price.json<IdempotentApiResponse>().error.code).toBe(
      "CART_PRICE_CHANGED",
    );
    expect(await countForKey(wrongTotalKey)).toBe(0);
    expect(
      await db.cartItem.count({ where: { cart: { userId: buyer1 } } }),
    ).toBe(1);
  });

  it("blocks out-of-stock product without committing a key or deleting cart", async () => {
    const fixture = await seedCart("stock");
    await db.product.update({
      where: { id: fixture.productId },
      data: { stock: 0 },
    });
    const key = newKey();
    const r = await send(key);
    expect(r.statusCode).toBe(409);
    expect(r.json<IdempotentApiResponse>().error.code).toBe(
      "PRODUCT_UNAVAILABLE",
    );
    expect(await countForKey(key)).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: fixture.cartId } })).toBe(
      1,
    );
  });

  it("concurrent requests with same key return one order after serializable retries", async () => {
    await seedCart("concurrent");
    const key = newKey();
    const before = await db.notification.count({
      where: { userId: buyer1, title: "Order received" },
    });
    const responses = await Promise.all([
      send(key),
      send(key),
      send(key),
      send(key),
    ]);
    expect(responses.every((r) => [200, 201].includes(r.statusCode))).toBe(
      true,
    );
    const ids = responses.map((r) => r.json<IdempotentApiResponse>().data.id);
    expect(new Set(ids).size).toBe(1);
    expect(responses.filter((r) => r.statusCode === 201).length).toBe(1);
    expect(await countForKey(key)).toBe(1);
    expect(
      await db.notification.count({
        where: { userId: buyer1, title: "Order received" },
      }),
    ).toBe(before + 1);
  });

  it("rolls back order, nonce, notification and cart when a database write fails", async () => {
    const fixture = await seedCart("notification-fails");
    const key = newKey();
    const originalOrders = await db.order.count({ where: { userId: buyer1 } });
    const originalNotifications = await db.notification.count({
      where: { userId: buyer1, title: "Order received" },
    });
    // A failure AFTER order insertion must roll the whole transaction back.
    // Trigger exists only inside the already-verified disposable PostgreSQL.
    await db.$executeRawUnsafe(
      "CREATE FUNCTION idempotency_fixture_reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture notification write failed'; END; $$",
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER idempotency_fixture_notification_fail BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION idempotency_fixture_reject_notification()',
    );
    try {
      const failed = await send(key);
      expect(failed.statusCode).toBe(500);
      expect(await countForKey(key)).toBe(0);
      expect(await db.order.count({ where: { userId: buyer1 } })).toBe(
        originalOrders,
      );
      expect(
        await db.notification.count({
          where: { userId: buyer1, title: "Order received" },
        }),
      ).toBe(originalNotifications);
      expect(
        await db.cartItem.count({ where: { cartId: fixture.cartId } }),
      ).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER idempotency_fixture_notification_fail ON "Notification"',
      );
      await db.$executeRawUnsafe(
        "DROP FUNCTION idempotency_fixture_reject_notification()",
      );
    }
    const retry = await send(key);
    expect(retry.statusCode).toBe(201);
    expect(await countForKey(key)).toBe(1);
  });

  it("new key cannot reuse a previously consumed cart", async () => {
    await seedCart("cart-consumed");
    const first = await send(newKey());
    expect(first.statusCode).toBe(201);
    const nextKey = newKey();
    const second = await send(nextKey);
    expect(second.statusCode).toBe(400);
    expect(second.json<IdempotentApiResponse>().error.code).toBe("EMPTY_CART");
    expect(await countForKey(nextKey)).toBe(0);
  });

  it("key scope belongs to buyer so a different buyer can use the same key", async () => {
    await seedCart("buyer1-scope", buyer1);
    await seedCart("buyer2-scope", buyer2);
    const key = newKey();
    const [first, second] = await Promise.all([
      send(key, body(addr1), buyer1),
      send(key, body(addr2), buyer2),
    ]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json<IdempotentApiResponse>().data.id).not.toBe(
      second.json<IdempotentApiResponse>().data.id,
    );
    expect(await db.orderIdempotency.count({ where: { key } })).toBe(2);
    expect(await countForKey(key, buyer1)).toBe(1);
    expect(await countForKey(key, buyer2)).toBe(1);
  });

  it("rejects reused key when a new cart has different items but identical total", async () => {
    await seedCart("original-same-total");
    const key = newKey();
    const old = await send(key);
    expect(old.statusCode).toBe(201);
    await seedCart("different-item-same-total");
    const replay = await send(key);
    expect(replay.statusCode).toBe(409);
    expect(replay.json<IdempotentApiResponse>().error.code).toBe(
      "IDEMPOTENCY_KEY_REUSED",
    );
    const fresh = await send(newKey());
    expect(fresh.statusCode).toBe(201);
    expect(fresh.json<IdempotentApiResponse>().data.id).not.toBe(
      old.json<IdempotentApiResponse>().data.id,
    );
  });

  it("two independent keys racing for the same cart never create two orders", async () => {
    await seedCart("different-keys");
    const a = newKey();
    const b = newKey();
    const results = await Promise.all([send(a), send(b)]);
    expect(results.filter((r) => r.statusCode === 201).length).toBe(1);
    expect(results.some((r) => r.statusCode !== 201)).toBe(true);
    const rows = await db.orderIdempotency.findMany({
      where: { buyerId: buyer1, key: { in: [a, b] } },
    });
    expect(rows.length).toBe(1);
  });
});
