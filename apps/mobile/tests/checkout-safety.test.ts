import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NATIVE_PRODUCTION_CHECKOUT_ENABLED,
  NATIVE_CHECKOUT_BLOCK_REASON,
  readKoraSession,
  readKoraVerification,
  trustedKoraCheckoutUrl,
} from "../src/lib/checkout-safety";
import {
  createIsolatedCheckoutCoordinator,
  type CheckoutIntent,
  type IsolatedCheckoutBackend,
} from "../src/lib/isolated-checkout-coordinator";
import type { Address, Cart } from "../src/lib/types";
import { api } from "../src/lib/api";

const reference = "EC-12345678-TEST";
const orderId = "order-1";
const goodSession = () => ({
  data: {
    orderId,
    reference,
    provider: "KORAPAY",
    status: "PENDING",
    currency: "NGN",
    authorizationUrl: "https://checkout.korapay.com/payment/fixture",
  },
});
const address: Address = {
  id: "delivery-1",
  label: "Home",
  line1: "1 Test Road",
  city: "Warri",
  region: "Delta",
  postalCode: "332001",
  country: "Nigeria",
  isDefault: true,
};
const cart: Cart = {
  id: "cart-1",
  subtotal: "2500.00",
  total: "2500.00",
  items: [
    {
      id: "item-1",
      quantity: 1,
      unitPrice: "2500.00",
      lineTotal: "2500.00",
      product: {
        id: "product-1",
        name: "Trainers",
        price: "2500.00",
        stock: 4,
        images: [],
        seller: { id: "seller-1", userId: "owner-1", displayName: "Shoes" },
      },
    },
  ],
};
const intent: CheckoutIntent = {
  buyerId: "buyer-1",
  addressId: address.id,
  idempotencyKey: "fixture-checkout-12345678",
  reviewedCart: cart,
};
function backend(overrides: Partial<IsolatedCheckoutBackend> = {}) {
  const calls = { orders: 0, initializes: 0, verifies: 0 };
  const defaultBackend: IsolatedCheckoutBackend = {
    cart: async () => structuredClone(cart),
    addresses: async () => [address],
    createOrder: async () => {
      calls.orders++;
      return { id: orderId, buyerId: intent.buyerId, total: cart.total };
    },
    initializeKora: async () => {
      calls.initializes++;
      return goodSession();
    },
    verifyKora: async () => {
      calls.verifies++;
      return { data: { orderId, reference, status: "PENDING" } };
    },
  };
  return { calls, adapter: { ...defaultBackend, ...overrides } };
}

test("native production payment remains compile-time blocked", () => {
  assert.equal(NATIVE_PRODUCTION_CHECKOUT_ENABLED, false);
  assert.ok(NATIVE_CHECKOUT_BLOCK_REASON.includes("idempotent KoraPay"));
  const keys = Object.keys(api);
  assert.ok(!keys.includes("createOrder"));
  assert.ok(!keys.includes("initializePayment"));
  assert.ok(!keys.includes("initializeKora"));
  assert.ok(!keys.includes("verifyPayment"));
});

test("allow only secure trusted KoraPay checkout URLs", () => {
  assert.equal(
    trustedKoraCheckoutUrl("https://checkout.korapay.com/pay/123"),
    "https://checkout.korapay.com/pay/123",
  );
  for (const unsafe of [
    "http://checkout.korapay.com/pay",
    "https://checkout.korapay.com.evil.test/pay",
    "https://evil.test/checkout.korapay.com",
    "javascript:alert(1)",
    "https://checkout.korapay.com:444/pay",
    "https://attacker@checkout.korapay.com/pay",
    "https://checkout.korapay.com/pay#pretend-success",
    "file:///etc/passwd",
    "",
    null,
    undefined,
  ])
    assert.equal(trustedKoraCheckoutUrl(unsafe), null);
});

test("rejects forged provider, amount currency, order, reference or success states", () => {
  assert.ok(readKoraSession(goodSession(), orderId));
  const bad: Array<Record<string, unknown>> = [
    { provider: "PAYSTACK" },
    { currency: "USD" },
    { orderId: "different-order" },
    { reference: "forged" },
    { status: "SUCCESS" },
    { authorizationUrl: "https://checkout.korapay.com.evil.test/" },
  ];
  for (const patch of bad) {
    const original = goodSession();
    assert.equal(
      readKoraSession({ data: { ...original.data, ...patch } }, orderId),
      null,
    );
  }
});

test("client redirects never imply payment confirmation", () => {
  const expected = { orderId, reference };
  assert.equal(
    readKoraVerification(
      { data: { orderId, reference, status: "SUCCESS" } },
      expected,
    ),
    null,
  );
  assert.equal(
    readKoraVerification(
      {
        data: { orderId, reference: "not-the-reference", status: "CONFIRMED" },
      },
      expected,
    ),
    null,
  );
  assert.equal(
    readKoraVerification(
      { data: { orderId: "other", reference, status: "CONFIRMED" } },
      expected,
    ),
    null,
  );
  assert.deepEqual(
    readKoraVerification(
      { data: { orderId, reference, status: "REVIEW_REQUIRED" } },
      expected,
    ),
    { orderId, reference, status: "REVIEW_REQUIRED" },
  );
});

test("invalid intent or changed cart blocks before any order creation", async () => {
  const f = backend({
    cart: async () => ({ ...cart, total: "3500.00", subtotal: "3500.00" }),
  });
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  assert.deepEqual(await coordinator.prepare(intent), {
    status: "BLOCKED",
    reason: "CART_CHANGED",
  });
  assert.deepEqual(
    await coordinator.prepare({ ...intent, idempotencyKey: "tiny" }),
    { status: "BLOCKED", reason: "INVALID_INTENT" },
  );
  assert.equal(f.calls.orders, 0);
});

test("foreign or missing delivery addresses block payment", async () => {
  const f = backend({ addresses: async () => [] });
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  assert.deepEqual(await coordinator.prepare(intent), {
    status: "BLOCKED",
    reason: "ADDRESS_NOT_FOUND",
  });
  assert.equal(f.calls.orders, 0);
});

test("concurrent duplicate checkout taps share one order and checkout session", async () => {
  const f = backend({
    createOrder: async () => {
      f.calls.orders++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: orderId, buyerId: intent.buyerId, total: cart.total };
    },
  });
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  const [a, b, c] = await Promise.all([
    coordinator.prepare(intent),
    coordinator.prepare(intent),
    coordinator.prepare(intent),
  ]);
  assert.equal(a.status, "READY");
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
  assert.equal(f.calls.orders, 1);
  assert.equal(f.calls.initializes, 1);
  const repeated = await coordinator.prepare(intent);
  assert.deepEqual(repeated, a);
  assert.equal(f.calls.orders, 1);
});

test("same idempotency key cannot silently refer to a changed address", async () => {
  const f = backend();
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  assert.equal((await coordinator.prepare(intent)).status, "READY");
  assert.deepEqual(
    await coordinator.prepare({ ...intent, addressId: "different-address" }),
    { status: "BLOCKED", reason: "INVALID_INTENT" },
  );
  assert.equal(f.calls.orders, 1);
});

test("retries reuse created order if payment session is unavailable", async () => {
  let attempts = 0;
  const f = backend({
    initializeKora: async () => {
      f.calls.initializes++;
      return ++attempts === 1
        ? {
            data: {
              ...goodSession().data,
              authorizationUrl: "https://bad.test/",
            },
          }
        : goodSession();
    },
  });
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  assert.deepEqual(await coordinator.prepare(intent), {
    status: "BLOCKED",
    reason: "INVALID_PAYMENT_SESSION",
  });
  assert.equal((await coordinator.prepare(intent)).status, "READY");
  assert.equal(f.calls.orders, 1);
  assert.equal(f.calls.initializes, 2);
});

test("rejects wrong buyer or total returned by isolated backend", async () => {
  const f = backend({
    createOrder: async () => {
      f.calls.orders++;
      return { id: orderId, buyerId: "other-buyer", total: cart.total };
    },
  });
  assert.deepEqual(
    await createIsolatedCheckoutCoordinator(f.adapter).prepare(intent),
    { status: "BLOCKED", reason: "ORDER_MISMATCH" },
  );
  assert.equal(f.calls.initializes, 0);
});

test("verification is read from backend, preserves pending status and never trusts redirect claims", async () => {
  const f = backend();
  const coordinator = createIsolatedCheckoutCoordinator(f.adapter);
  const prepared = await coordinator.prepare(intent);
  assert.equal(prepared.status, "READY");
  if (prepared.status !== "READY") throw Error("Unexpected result");
  const response = await coordinator.verify(prepared.session);
  assert.deepEqual(response, { status: "PENDING", orderId, reference });
  assert.equal(f.calls.verifies, 1);
});
