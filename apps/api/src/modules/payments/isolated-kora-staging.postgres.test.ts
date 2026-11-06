import { createHmac } from "node:crypto";
import { PrismaClient } from "@eazicart/database";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { AppError } from "../../errors.js";
import { registerIsolatedKoraStaging } from "./isolated-kora-staging.js";
import { createKoraCheckoutOnce } from "./korapay-checkout-once-candidate.js";
import { createKoraPreviewCheckoutStore } from "./korapay-checkout-api-candidate.js";

type Payload = {
  data: {
    id: string;
    orderId: string;
    reference: string;
    status: string;
    provider: string;
    currency: string;
    authorizationUrl: string;
  };
  replayed?: boolean;
  error?: { code: string };
};

const u = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const ephemeral =
  process.env.NODE_ENV === "test" &&
  process.env.EAZICART_IDEM_DISPOSABLE === "1" &&
  process.env.EAZICART_KORA_FIXTURE_ONLY === "1" &&
  u?.protocol === "postgresql:" &&
  u.username === "root" &&
  u.hostname === "localhost" &&
  u.pathname === "/postgres" &&
  u.searchParams.get("host") === "/var/run/postgresql" &&
  u.port === process.env.PGPORT &&
  Number(u.port) !== 5432;
const run = ephemeral ? describe : describe.skip;

run("Order -> KoraPay synthetic staging (disposable PostgreSQL only)", () => {
  const db = new PrismaClient();
  const app = Fastify();
  const buyer = "staging-kora-buyer";
  const stranger = "staging-kora-stranger";
  const admin = "staging-kora-admin";
  const seller = "staging-kora-seller";
  const profile = "staging-kora-store";
  const category = "staging-kora-category";
  const addressBuyer = "staging-kora-address";
  const addressStranger = "staging-kora-stranger-address";
  const secret = "ONLY-SYNTHETIC-WEBHOOK-SECRET";
  const providerState = new Map<
    string,
    "processing" | "success" | "underpaid" | "unavailable" | "wrong-currency"
  >();
  const providerCalls: Array<{
    kind: "initialize" | "verify";
    reference: string;
  }> = [];
  let initializeMode: "normal" | "unavailable" | "unsafe-url" = "normal";
  let counter = 0;
  const code = () => String(++counter).padStart(5, "0");
  const key = () => "fixture-session-" + code() + "-idempotency";
  const headers = (user = buyer) => ({ authorization: "Bearer " + user });
  const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify({ status: true, data }), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fakeKoraProvider = (
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> => {
    if (
      !endpoint.startsWith("https://api.korapay.com/merchant/api/v1/charges/")
    ) {
      throw new Error("Unexpected external URL in synthetic provider fixture");
    }
    if (endpoint.endsWith("/initialize")) {
      if (typeof init.body !== "string")
        throw new Error("Synthetic provider expects JSON string");
      const body = JSON.parse(init.body) as {
        reference: string;
        amount: number;
        currency: string;
      };
      providerCalls.push({ kind: "initialize", reference: body.reference });
      if (initializeMode === "unavailable")
        return Promise.resolve(
          new Response("synthetic unavailable", { status: 503 }),
        );
      if (initializeMode === "unsafe-url")
        return Promise.resolve(
          response({
            reference: body.reference,
            checkout_url: "https://checkout.korapay.com.evil.test/unsafe",
          }),
        );

      if (
        init.method !== "POST" ||
        body.amount !== 1250 ||
        body.currency !== "NGN"
      )
        throw new Error("Incorrect provider initialization");
      return Promise.resolve(
        response({
          reference: body.reference,
          checkout_url: "https://checkout.korapay.com/synthetic-fixture",
        }),
      );
    }
    const reference = decodeURIComponent(endpoint.split("/").at(-1) ?? "");
    providerCalls.push({ kind: "verify", reference });
    const state = providerState.get(reference) ?? "processing";
    if (state === "unavailable")
      return Promise.resolve(new Response("unavailable", { status: 503 }));
    return Promise.resolve(
      response({
        reference,
        status: state === "processing" ? "processing" : "success",
        amount: "1250",
        amount_paid: state === "underpaid" ? "1000" : "1250",
        currency: state === "wrong-currency" ? "USD" : "NGN",
      }),
    );
  };

  const order = (
    body: {
      addressId: string;
      expectedTotal: string;
      cartSnapshot: Array<{
        productId: string;
        quantity: number;
        unitPrice: string;
      }>;
    },
    idempotencyKey: string,
    user = buyer,
  ) =>
    app.inject({
      method: "POST",
      url: "/preview/orders/idempotent",
      headers: { ...headers(user), "idempotency-key": idempotencyKey },
      payload: body,
    });
  const pay = (orderId: string, user = buyer) =>
    app.inject({
      method: "POST",
      url: "/preview/korapay/checkout",
      headers: headers(user),
      payload: { orderId },
    });
  const reconcileList = (user = admin, query = "") =>
    app.inject({
      method: "GET",
      url: "/preview/admin/korapay/reconciliation" + query,
      headers: headers(user),
    });
  const reconcileReport = (user = admin) =>
    app.inject({
      method: "GET",
      url: "/preview/admin/korapay/reconciliation/report",
      headers: headers(user),
    });
  const reconcileExport = (query = "", user = admin) =>
    app.inject({
      method: "GET",
      url: "/preview/admin/korapay/reconciliation/export.csv" + query,
      headers: headers(user),
    });
  const reconcileProbe = (paymentId: string, user = admin) =>
    app.inject({
      method: "GET",
      url:
        "/preview/admin/korapay/reconciliation/" +
        encodeURIComponent(paymentId) +
        "/probe",
      headers: headers(user),
    });
  const verify = (orderId: string, user = buyer) =>
    app.inject({
      method: "GET",
      url: "/preview/korapay/orders/" + encodeURIComponent(orderId) + "/verify",
      headers: headers(user),
    });
  const webhook = (reference: string, signed = true) => {
    const data = {
      reference,
      fee: 0,
      amount: 1250,
      status: "success",
      currency: "NGN",
    };
    const signature = signed
      ? createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex")
      : "bad-signature";
    return app.inject({
      method: "POST",
      url: "/preview/korapay/webhook",
      headers: { "x-korapay-signature": signature },
      payload: { event: "charge.success", data },
    });
  };

  async function cartFixture(suffix: string, owner = buyer, price = "1250") {
    const productId = "staging-kora-product-" + suffix;
    await db.product.create({
      data: {
        id: productId,
        name: "Synthetic product " + suffix,
        price,
        stock: 4,
        sellerId: profile,
        categoryId: category,
        active: true,
      },
    });
    const cart = await db.cart.upsert({
      where: { userId: owner },
      create: { userId: owner },
      update: {},
    });
    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity: 1,
      },
    });
    return {
      productId,
      cartId: cart.id,
      request: {
        addressId: owner === buyer ? addressBuyer : addressStranger,
        expectedTotal: price,
        cartSnapshot: [{ productId, quantity: 1, unitPrice: price }],
      },
    };
  }

  beforeAll(async () => {
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
      const user = request.headers.authorization?.replace(/^Bearer /, "");
      if (user !== buyer && user !== stranger && user !== admin)
        throw new AppError(401, "UNAUTHORIZED", "Login required");
      request.userId = user;
      return Promise.resolve();
    });
    await registerIsolatedKoraStaging(app, db, {
      fetcher: fakeKoraProvider,
      webhookSecret: secret,
      redirectUrl: "https://preview.example.test/payment-pending",
      notificationUrl: "https://preview.example.test/preview/korapay/webhook",
    });
    await db.user.createMany({
      data: [
        {
          id: buyer,
          email: "kora-buyer@example.test",
          name: "Synthetic buyer",
          passwordHash: "fixture",
        },
        {
          id: stranger,
          email: "kora-other@example.test",
          name: "Synthetic other",
          passwordHash: "fixture",
        },
        {
          id: seller,
          email: "kora-seller@example.test",
          name: "Synthetic seller",
          passwordHash: "fixture",
        },
        {
          id: admin,
          email: "kora-admin@example.test",
          name: "Synthetic admin",
          role: "ADMIN",
          passwordHash: "fixture",
        },
      ],
    });
    await db.sellerProfile.create({
      data: { id: profile, userId: seller, displayName: "Synthetic store" },
    });
    await db.category.create({
      data: { id: category, name: "Synthetic shoes", slug: "synthetic-shoes" },
    });
    await db.address.createMany({
      data: [
        {
          id: addressBuyer,
          userId: buyer,
          line1: "Fixture lane",
          city: "Warri",
          region: "Delta",
          postalCode: "000001",
          country: "NG",
        },
        {
          id: addressStranger,
          userId: stranger,
          line1: "Fixture square",
          city: "Aba",
          region: "Abia",
          postalCode: "000002",
          country: "NG",
        },
      ],
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it("refuses to register without disposable fixture flag", async () => {
    const prev = process.env.EAZICART_KORA_FIXTURE_ONLY;
    const secondApp = Fastify();
    process.env.EAZICART_KORA_FIXTURE_ONLY = "0";
    try {
      await expect(
        registerIsolatedKoraStaging(secondApp, db, {
          fetcher: fakeKoraProvider,
          webhookSecret: secret,
          redirectUrl: "https://preview.example.test/payment-pending",
          notificationUrl:
            "https://preview.example.test/preview/korapay/webhook",
        }),
      ).rejects.toThrow(/isolated test environment/);
    } finally {
      process.env.EAZICART_KORA_FIXTURE_ONLY = prev;
      await secondApp.close();
    }
  });

  it("creates one order after concurrent taps and only one pending Kora payment", async () => {
    const f = await cartFixture("duplicate");
    const idempotencyKey = key();
    const orders = await Promise.all([
      order(f.request, idempotencyKey),
      order(f.request, idempotencyKey),
      order(f.request, idempotencyKey),
    ]);
    expect(orders.every((r) => [200, 201].includes(r.statusCode))).toBe(true);
    const orderIds = orders.map((r) => r.json<Payload>().data.id);
    expect(new Set(orderIds).size).toBe(1);
    const orderId = orderIds[0];
    if (!orderId) throw new Error("Synthetic order id missing");
    const providerBefore = providerCalls.filter(
      (x) => x.kind === "initialize",
    ).length;
    const initialized = await Promise.all([pay(orderId), pay(orderId)]);
    expect(
      initialized.every((r) => [200, 201, 503].includes(r.statusCode)),
    ).toBe(true);
    const ready = initialized.find((r) => r.statusCode === 201);
    if (!ready) throw new Error("Claimed provider request must be ready");
    const payment = ready.json<Payload>().data;
    const replay = await pay(orderId);
    expect(replay.statusCode).toBe(200);
    expect(replay.json<Payload>().data.reference).toBe(payment.reference);
    expect(
      providerCalls.filter((x) => x.kind === "initialize").length -
        providerBefore,
    ).toBe(1);
    const persisted = await db.payment.findUniqueOrThrow({
      where: { orderId },
    });
    const claim = await db.koraCheckoutAttempt.findUniqueOrThrow({
      where: { paymentId: persisted.id },
    });
    expect(claim.reference).toBe(payment.reference);
    expect(claim.state).toBe("READY");
    expect(claim.authorizationUrl).toBe(payment.authorizationUrl);
    expect(payment).toMatchObject({
      orderId,
      provider: "KORAPAY",
      status: "PENDING",
      currency: "NGN",
    });
    expect(payment.authorizationUrl).toBe(
      "https://checkout.korapay.com/synthetic-fixture",
    );
    expect(await db.payment.count({ where: { orderId } })).toBe(1);
    expect(
      await db.order.count({ where: { userId: buyer, id: orderId } }),
    ).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(4);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("PENDING");
  });

  it("prevents unauthenticated or another buyer from initiating or verifying payment", async () => {
    const f = await cartFixture("auth");
    const created = await order(f.request, key());
    const orderId = created.json<Payload>().data.id;
    const guestPay = await app.inject({
      method: "POST",
      url: "/preview/korapay/checkout",
      payload: { orderId },
    });
    expect(guestPay.statusCode).toBe(401);
    expect((await pay(orderId, stranger)).statusCode).toBe(404);
    expect((await verify(orderId, stranger)).statusCode).toBe(404);
    expect(await db.payment.count({ where: { orderId } })).toBe(0);
  });

  it("does not settle pending or underpaid provider checks", async () => {
    const f = await cartFixture("pending");
    const created = await order(f.request, key());
    const orderId = created.json<Payload>().data.id;
    const result = await pay(orderId);
    const reference = result.json<Payload>().data.reference;
    providerState.set(reference, "processing");
    expect((await verify(orderId)).json<Payload>().data.status).toBe("PENDING");
    providerState.set(reference, "underpaid");
    expect((await verify(orderId)).statusCode).toBe(503);
    expect((await webhook(reference)).statusCode).toBe(503);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("PENDING");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(4);
  });

  it("forged webhook signature never initiates settlement", async () => {
    const f = await cartFixture("signature");
    const created = await order(f.request, key());
    const orderId = created.json<Payload>().data.id;
    const reference = (await pay(orderId)).json<Payload>().data.reference;
    providerState.set(reference, "success");
    expect((await webhook(reference, false)).statusCode).toBe(401);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("PENDING");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(4);
  });

  it("signed webhook, repeated webhooks and buyer verify settle stock exactly once", async () => {
    const f = await cartFixture("settle");
    const idempotencyKey = key();
    const created = await order(f.request, idempotencyKey);
    const orderId = created.json<Payload>().data.id;
    const reference = (await pay(orderId)).json<Payload>().data.reference;
    const originalPaymentConfirmations = await db.notification.count({
      where: { userId: buyer, title: "Payment confirmed" },
    });
    providerState.set(reference, "success");
    const replies = await Promise.all([
      webhook(reference),
      webhook(reference),
      webhook(reference),
      verify(orderId),
    ]);
    expect(replies.every((r) => r.statusCode === 200)).toBe(true);
    expect((await verify(orderId)).json<Payload>().data.status).toBe(
      "CONFIRMED",
    );
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("SUCCESS");
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
    ).toBe("CONFIRMED");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(3);
    expect(await db.sellerFulfillment.count({ where: { orderId } })).toBe(1);
    expect(
      await db.notification.count({
        where: { userId: buyer, title: "Payment confirmed" },
      }),
    ).toBe(originalPaymentConfirmations + 1);
    const replay = await order(f.request, idempotencyKey);
    expect(replay.statusCode).toBe(200);
    expect(replay.json<Payload>().data.id).toBe(orderId);
  });

  it("recovers when provider verification is temporarily unavailable", async () => {
    const f = await cartFixture("recovery");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const reference = (await pay(orderId)).json<Payload>().data.reference;
    providerState.set(reference, "unavailable");
    expect((await verify(orderId)).statusCode).toBe(503);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("PENDING");
    providerState.set(reference, "success");
    expect((await verify(orderId)).json<Payload>().data.status).toBe(
      "CONFIRMED",
    );
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(3);
  });

  it("verified payment with depleted stock enters review without overselling", async () => {
    const f = await cartFixture("out-of-stock");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const reference = (await pay(orderId)).json<Payload>().data.reference;
    await db.product.update({ where: { id: f.productId }, data: { stock: 0 } });
    providerState.set(reference, "success");
    const result = await webhook(reference);
    expect(result.statusCode).toBe(200);
    expect((await verify(orderId)).json<Payload>().data.status).toBe(
      "REVIEW_REQUIRED",
    );
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("REVIEW_REQUIRED");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(0);
    expect(await db.sellerFulfillment.count({ where: { orderId } })).toBe(0);
  });

  it("retains Paystack history and rejects provider switching", async () => {
    const f = await cartFixture("history");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    await db.payment.create({
      data: {
        orderId,
        provider: "PAYSTACK",
        reference: "historical-paystack-" + code(),
        status: "PENDING",
        amount: "1250",
        currency: "NGN",
      },
    });
    const result = await pay(orderId);
    expect(result.statusCode).toBe(409);
    expect(result.json<Payload>().error?.code).toBe(
      "PAYMENT_PROVIDER_CONFLICT",
    );
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).provider,
    ).toBe("PAYSTACK");
  });

  it("cannot settle a provider-reported success with incorrect currency", async () => {
    const f = await cartFixture("currency");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const reference = (await pay(orderId)).json<Payload>().data.reference;
    providerState.set(reference, "wrong-currency");
    expect((await verify(orderId)).statusCode).toBe(503);
    expect(
      (await db.payment.findUniqueOrThrow({ where: { orderId } })).status,
    ).toBe("PENDING");
  });

  it("keeps idempotency persisted across independent in-memory coordinators", async () => {
    const f = await cartFixture("durable");
    const sameKey = key();
    const first = await order(f.request, sameKey);
    const orderId = first.json<Payload>().data.id;
    // The route recreates its transaction on every request. No client or
    // in-process coordinator state is used for retries.
    const second = await order(f.request, sameKey);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json<Payload>().data.id).toBe(orderId);
    expect(
      await db.orderIdempotency.count({
        where: { buyerId: buyer, key: sameKey },
      }),
    ).toBe(1);
  });

  it("runs real HTTP order, checkout, signed callback and verification on loopback only", async () => {
    const f = await cartFixture("loopback");
    await app.listen({ host: "127.0.0.1", port: 0 });
    const addr = app.server.address();
    if (!addr || typeof addr === "string" || addr.address !== "127.0.0.1")
      throw new Error("Refusing non-loopback staging listener");
    const origin = "http://127.0.0.1:" + addr.port;
    const postJson = async (
      path: string,
      payload: unknown,
      extraHeaders: Record<string, string> = {},
    ) => {
      const res = await fetch(origin + path, {
        method: "POST",
        headers: { "content-type": "application/json", ...extraHeaders },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      return res;
    };
    const start = await postJson("/preview/orders/idempotent", f.request, {
      ...headers(),
      "idempotency-key": key(),
    });
    expect(start.status).toBe(201);
    const orderId = ((await start.json()) as Payload).data.id;
    const initiated = await postJson(
      "/preview/korapay/checkout",
      { orderId },
      headers(),
    );
    expect(initiated.status).toBe(201);
    const session = ((await initiated.json()) as Payload).data;
    expect(session.provider).toBe("KORAPAY");
    expect(new URL(session.authorizationUrl).hostname).toBe(
      "checkout.korapay.com",
    );
    providerState.set(session.reference, "processing");
    const getVerify = async () =>
      fetch(
        origin +
          "/preview/korapay/orders/" +
          encodeURIComponent(orderId) +
          "/verify",
        {
          headers: headers(),
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
    const pending = await getVerify();
    expect(pending.status).toBe(200);
    expect(((await pending.json()) as Payload).data.status).toBe("PENDING");
    providerState.set(session.reference, "success");
    const data = {
      reference: session.reference,
      fee: 0,
      amount: 1250,
      status: "success",
      currency: "NGN",
    };
    const signature = createHmac("sha256", secret)
      .update(JSON.stringify(data))
      .digest("hex");
    const callback = await postJson(
      "/preview/korapay/webhook",
      { event: "charge.success", data },
      { "x-korapay-signature": signature },
    );
    expect(callback.status).toBe(200);
    const confirmed = await getVerify();
    expect(confirmed.status).toBe(200);
    expect(((await confirmed.json()) as Payload).data.status).toBe("CONFIRMED");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: f.productId } }))
        .stock,
    ).toBe(3);
    expect(await db.sellerFulfillment.count({ where: { orderId } })).toBe(1);
  });

  it("provider outage becomes UNKNOWN; retries cannot initialize again", async () => {
    const f = await cartFixture("init-outage");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const before = providerCalls.filter((c) => c.kind === "initialize").length;
    initializeMode = "unavailable";
    try {
      const first = await pay(orderId);
      expect(first.statusCode).toBe(503);
      expect(first.json<Payload>().error?.code).toBe(
        "KORAPAY_INITIATION_UNCERTAIN",
      );
    } finally {
      initializeMode = "normal";
    }
    expect((await pay(orderId)).statusCode).toBe(503);
    expect(
      providerCalls.filter((c) => c.kind === "initialize").length - before,
    ).toBe(1);
    const p = await db.payment.findUniqueOrThrow({ where: { orderId } });
    const claim = await db.koraCheckoutAttempt.findUniqueOrThrow({
      where: { paymentId: p.id },
    });
    expect(claim.state).toBe("UNKNOWN");
    expect(p.status).toBe("PENDING");
  });

  it("orphaned IN_PROGRESS claim fails closed even after app restart", async () => {
    const f = await cartFixture("init-orphan");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const reference = "EC-synthetic-orphan-123456789";
    const p = await db.payment.create({
      data: {
        orderId,
        reference,
        provider: "KORAPAY",
        status: "PENDING",
        amount: "1250",
        currency: "NGN",
      },
    });
    await db.koraCheckoutAttempt.create({
      data: {
        paymentId: p.id,
        reference,
        state: "INITIATING",
      },
    });
    const before = providerCalls.filter((c) => c.kind === "initialize").length;
    expect((await pay(orderId)).statusCode).toBe(503);
    expect((await pay(orderId)).statusCode).toBe(503);
    expect(providerCalls.filter((c) => c.kind === "initialize").length).toBe(
      before,
    );
  });

  it("spoofed provider checkout URL never persists or causes a second initialize", async () => {
    const f = await cartFixture("init-unsafe-url");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const before = providerCalls.filter((c) => c.kind === "initialize").length;
    initializeMode = "unsafe-url";
    try {
      expect((await pay(orderId)).statusCode).toBe(503);
    } finally {
      initializeMode = "normal";
    }
    expect((await pay(orderId)).statusCode).toBe(503);
    expect(
      providerCalls.filter((c) => c.kind === "initialize").length - before,
    ).toBe(1);
    const p = await db.payment.findUniqueOrThrow({ where: { orderId } });
    const claim = await db.koraCheckoutAttempt.findUniqueOrThrow({
      where: { paymentId: p.id },
    });
    expect(claim.state).toBe("UNKNOWN");
    expect(claim.authorizationUrl).toBeNull();
  });

  it("a new application instance reuses the saved checkout URL without a provider call", async () => {
    const f = await cartFixture("independent-instance");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const started = await pay(orderId);
    expect(started.statusCode).toBe(201);
    const session = started.json<Payload>().data;
    const before = providerCalls.filter((c) => c.kind === "initialize").length;
    const separateDb = new PrismaClient();
    try {
      const separateStore = createKoraPreviewCheckoutStore(separateDb);
      const independent = createKoraCheckoutOnce(separateDb, separateStore, {
        secret,
        fetcher: fakeKoraProvider,
        redirectUrl: "https://preview.example.test/payment-pending",
        notificationUrl: "https://preview.example.test/preview/korapay/webhook",
      });
      const owned = await separateStore.prepareOwned(orderId, buyer);
      const reply = await independent.start(owned, buyer);
      expect(reply.replayed).toBe(true);
      expect(reply.checkoutUrl).toBe(session.authorizationUrl);
    } finally {
      await separateDb.$disconnect();
    }
    expect(providerCalls.filter((c) => c.kind === "initialize").length).toBe(
      before,
    );
  });

  it("reconciliation listing requires a real ADMIN role and never exposes PII", async () => {
    const unauth = await app.inject({
      method: "GET",
      url: "/preview/admin/korapay/reconciliation",
    });
    expect(unauth.statusCode).toBe(401);
    expect((await reconcileList(buyer)).statusCode).toBe(403);
    expect((await reconcileList(stranger)).statusCode).toBe(403);
    expect((await reconcileList(admin, "?limit=100")).statusCode).toBe(400);
    expect((await reconcileList(admin, "?state=READY")).statusCode).toBe(400);

    const listed = await reconcileList(admin, "?limit=1&state=UNKNOWN");
    expect(listed.statusCode).toBe(200);
    const payload = listed.json<{ data: Array<Record<string, unknown>> }>();
    expect(payload.data.length).toBeLessThanOrEqual(1);
    if (payload.data.length) {
      expect(Object.keys(payload.data[0]!).sort()).toEqual(
        [
          "action",
          "createdAt",
          "currency",
          "orderId",
          "paymentId",
          "paymentStatus",
          "reference",
          "referenceMatches",
          "state",
          "updatedAt",
        ].sort(),
      );
      const publicResult = listed.body;
      expect(publicResult).not.toContain("authorizationUrl");
      expect(publicResult).not.toContain("checkout.korapay.com");
      expect(publicResult).not.toContain("@example.test");
    }
    // Actual database role, not bearer header contents, determines access.
    await db.user.update({ where: { id: admin }, data: { role: "BUYER" } });
    try {
      expect((await reconcileList(admin)).statusCode).toBe(403);
    } finally {
      await db.user.update({ where: { id: admin }, data: { role: "ADMIN" } });
    }
  });

  it("read-only provider probe reports verified evidence but never settles or adjusts stock", async () => {
    const f = await cartFixture("recon-provider-evidence");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    initializeMode = "unavailable";
    try {
      expect((await pay(orderId)).statusCode).toBe(503);
    } finally {
      initializeMode = "normal";
    }
    const payment = await db.payment.findUniqueOrThrow({ where: { orderId } });
    const beforeClaim = await db.koraCheckoutAttempt.findUniqueOrThrow({
      where: { paymentId: payment.id },
    });
    expect(beforeClaim.state).toBe("UNKNOWN");
    const beforeOrder = await db.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const beforeProduct = await db.product.findUniqueOrThrow({
      where: { id: f.productId },
    });
    const beforeFulfillment = await db.sellerFulfillment.count({
      where: { orderId },
    });
    const beforeNotifications = await db.notification.count({
      where: { userId: buyer },
    });
    const beforeProviderCalls = providerCalls.filter(
      (c) => c.kind === "initialize",
    ).length;
    providerState.set(payment.reference, "success");
    expect((await reconcileProbe(payment.id, buyer)).statusCode).toBe(403);
    const examined = await reconcileProbe(payment.id);
    expect(examined.statusCode).toBe(200);
    expect(
      examined.json<{
        data: {
          providerCheck: string;
          action: string;
          mayInitializeAgain: boolean;
          localPaymentUpdated: boolean;
        };
      }>().data,
    ).toMatchObject({
      providerCheck: "VERIFIED",
      action: "MANUAL_REVIEW_REQUIRED",
      mayInitializeAgain: false,
      localPaymentUpdated: false,
    });
    expect((await reconcileProbe(payment.id)).statusCode).toBe(200);
    expect(providerCalls.filter((c) => c.kind === "initialize").length).toBe(
      beforeProviderCalls,
    );
    expect(
      await db.koraCheckoutAttempt.findUniqueOrThrow({
        where: { paymentId: payment.id },
      }),
    ).toEqual(beforeClaim);
    expect(await db.payment.findUniqueOrThrow({ where: { orderId } })).toEqual(
      payment,
    );
    expect(
      await db.order.findUniqueOrThrow({ where: { id: orderId } }),
    ).toEqual(beforeOrder);
    expect(
      await db.product.findUniqueOrThrow({ where: { id: f.productId } }),
    ).toEqual(beforeProduct);
    expect(await db.sellerFulfillment.count({ where: { orderId } })).toBe(
      beforeFulfillment,
    );
    expect(await db.notification.count({ where: { userId: buyer } })).toBe(
      beforeNotifications,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/preview/admin/korapay/reconciliation/" + payment.id + "/probe",
          headers: headers(admin),
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
  });

  it("probe cannot be tricked into an incorrect currency, reference or payment transition", async () => {
    const f = await cartFixture("recon-invalid-reference");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    const reference = "EC-recon-fake-1234567890";
    const payment = await db.payment.create({
      data: {
        orderId,
        reference,
        status: "PENDING",
        provider: "KORAPAY",
        amount: "1250",
        currency: "NGN",
      },
    });
    await db.koraCheckoutAttempt.create({
      data: {
        paymentId: payment.id,
        reference: "EC-recon-different-12345678",
        state: "UNKNOWN",
      },
    });
    const before = providerCalls.length;
    expect((await reconcileProbe(payment.id)).statusCode).toBe(409);
    expect(providerCalls.length).toBe(before);
    await db.koraCheckoutAttempt.update({
      where: { paymentId: payment.id },
      data: { reference },
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { currency: "USD" },
    });
    expect((await reconcileProbe(payment.id)).statusCode).toBe(409);
    expect(providerCalls.length).toBe(before);
    await db.payment.update({
      where: { id: payment.id },
      data: { currency: "NGN", status: "SUCCESS" },
    });
    expect((await reconcileProbe(payment.id)).statusCode).toBe(409);
    expect(providerCalls.length).toBe(before);
  });

  it("pending, underpaid and unavailable provider checks remain observation-only", async () => {
    const f = await cartFixture("recon-observation");
    const orderId = (await order(f.request, key())).json<Payload>().data.id;
    initializeMode = "unavailable";
    try {
      expect((await pay(orderId)).statusCode).toBe(503);
    } finally {
      initializeMode = "normal";
    }
    const p = await db.payment.findUniqueOrThrow({ where: { orderId } });
    for (const [state, expected] of [
      ["processing", "NOT_PAID"],
      ["underpaid", "UNVERIFIED"],
      ["unavailable", "UNVERIFIED"],
    ] as const) {
      providerState.set(p.reference, state);
      const probe = await reconcileProbe(p.id);
      expect(probe.statusCode).toBe(200);
      expect(
        probe.json<{ data: { providerCheck: string } }>().data.providerCheck,
      ).toBe(expected);
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: p.id } })).status,
      ).toBe("PENDING");
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
      ).toBe("PENDING");
    }
  });

  it("admin report summarizes uncertain claims without side effects", async () => {
    const unauthorized = await app.inject({
      method: "GET",
      url: "/preview/admin/korapay/reconciliation/report",
    });
    expect(unauthorized.statusCode).toBe(401);
    expect((await reconcileReport(buyer)).statusCode).toBe(403);
    const beforeProviderCalls = providerCalls.length;
