import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";
import {
  cartFingerprint,
  canCheckoutReview,
  hasCartChanged,
} from "../src/lib/commerce";
import type { Cart } from "../src/lib/types";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("cart and address endpoints cannot be used without sign-in", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return ok({});
  };
  for (const call of [
    () => api.cart(),
    () => api.cartAdd("p1", 1),
    () => api.cartUpdate("item1", 2),
    () => api.cartRemove("item1"),
    () => api.cartClear(),
    () => api.addresses(),
    () => api.orders(),
    () =>
      api.createAddress({
        label: "Home",
        line1: "Street",
        city: "Lagos",
        region: "Lagos",
        postalCode: "100001",
        country: "Nigeria",
        isDefault: true,
      }),
  ]) {
    await assert.rejects(
      call(),
      (e: unknown) => e instanceof ApiError && e.status === 401,
    );
  }
  assert.equal(calls, 0);
});

test("cart add and quantity update follow the existing backend contract", async () => {
  setAccessToken("buyer-test-token");
  const requests: Array<{
    path: string;
    method: string;
    body: unknown;
    authorization: string | null;
  }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(String(input)).pathname,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    return ok({ data: { id: "cart1", items: [], subtotal: "0", total: "0" } });
  };
  await api.cartAdd("product-one", 2);
  await api.cartUpdate("item-one", 3);
  assert.deepEqual(
    requests.map((r) => [r.path, r.method, r.body]),
    [
      ["/api/cart/items", "POST", { productId: "product-one", quantity: 2 }],
      ["/api/cart/items/item-one", "PATCH", { quantity: 3 }],
    ],
  );
  assert.ok(
    requests.every((r) => r.authorization === "Bearer buyer-test-token"),
  );
});

test("cart item removal and clearing use DELETE with no payment operation", async () => {
  setAccessToken("buyer-test-token");
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
    return new Response(null, { status: 204 });
  };
  await api.cartRemove("item1");
  await api.cartClear();
  assert.deepEqual(requests, [
    "DELETE /api/cart/items/item1",
    "DELETE /api/cart",
  ]);
});

test("addresses create uses the existing validated delivery address fields", async () => {
  setAccessToken("buyer-test-token");
  const input = {
    label: "Office",
    line1: "12 Test Street",
    city: "Warri",
    region: "Delta",
    postalCode: "332001",
    country: "Nigeria",
    isDefault: false,
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).pathname, "/api/addresses");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), input);
    return ok({ data: { ...input, id: "address1" } }, 201);
  };
  assert.equal((await api.createAddress(input)).data.id, "address1");
});

const makeCart = (price = "1200.00", quantity = 1): Cart => ({
  id: "cart1",
  subtotal: price,
  total: price,
  items: [
    {
      id: "item1",
      unitPrice: price,
      lineTotal: price,
      quantity,
      product: {
        id: "product1",
        name: "Shoes",
        price,
        images: [],
        stock: 5,
        active: true,
        seller: { id: "seller1", userId: "user1", displayName: "Shop" },
      },
    },
  ],
});
test("checkout review identifies changed prices or quantities before order creation", () => {
  const old = makeCart();
  assert.equal(hasCartChanged(old, makeCart()), false);
  assert.equal(hasCartChanged(old, makeCart("1300.00")), true);
  assert.equal(hasCartChanged(old, makeCart("1200.00", 2)), true);
  assert.ok(cartFingerprint(old).includes("product1"));
});
test("checkout review refuses empty and insufficient-stock carts", () => {
  assert.equal(canCheckoutReview({ ...makeCart(), items: [] }), false);
  assert.equal(canCheckoutReview(makeCart("1000", 6)), false);
  assert.equal(canCheckoutReview(makeCart()), true);
});
test("native commerce API exposes no payment initialization or order creation action", () => {
  const methods = Object.keys(api);
  assert.equal(methods.includes("initializePayment"), false);
  assert.equal(methods.includes("createOrder"), false);
  assert.equal(methods.includes("paymentInitialize"), false);
});

test("checkout review detects a variant switch even when product, quantity and total stay the same", () => {
  const old = {
    ...makeCart(),
    items: [{ ...makeCart().items[0], variantLabel: "Size M" }],
  };
  const latest = {
    ...old,
    items: [{ ...old.items[0], variantLabel: "Size L" }],
  };
  assert.equal(hasCartChanged(old, latest), true);
});

test("checkout review detects inventory becoming unavailable without a price change", () => {
  const old = makeCart();
  const unavailable = {
    ...old,
    items: [
      { ...old.items[0], product: { ...old.items[0].product, stock: 0 } },
    ],
  };
  const disabled = {
    ...old,
    items: [
      { ...old.items[0], product: { ...old.items[0].product, active: false } },
    ],
  };
  assert.equal(hasCartChanged(old, unavailable), true);
  assert.equal(hasCartChanged(old, disabled), true);
});

test("checkout review detects changed delivery fees, line totals and cart items", () => {
  const old = makeCart();
  assert.equal(hasCartChanged(old, { ...old, delivery: "450.00" }), true);
  assert.equal(hasCartChanged(old, { ...old, serviceFee: "100.00" }), true);
  assert.equal(
    hasCartChanged(old, {
      ...old,
      items: [{ ...old.items[0], lineTotal: "1199.00" }],
    }),
    true,
  );
  assert.equal(
    hasCartChanged(old, {
      ...old,
      items: [{ ...old.items[0], id: "different-cart-item" }],
    }),
    true,
  );
});

test("checkout review comparison does not depend on server item order", () => {
  const first = makeCart();
  const second = {
    ...first.items[0],
    id: "item-two",
    quantity: 2,
    product: { ...first.items[0].product, id: "product-two" },
  };
  const reviewed = { ...first, items: [first.items[0], second] };
  const latest = { ...reviewed, items: [...reviewed.items].reverse() };
  assert.equal(hasCartChanged(reviewed, latest), false);
});

test("checkout review refuses fractional, infinite and negative stock quantities", () => {
  const base = makeCart();
  for (const quantity of [0.5, Number.POSITIVE_INFINITY, Number.NaN, -1]) {
    assert.equal(
      canCheckoutReview({
        ...base,
        items: [{ ...base.items[0], quantity }],
      }),
      false,
    );
  }
  for (const stock of [1.5, -1, Number.NaN]) {
    assert.equal(
      canCheckoutReview({
        ...base,
        items: [
          { ...base.items[0], product: { ...base.items[0].product, stock } },
        ],
      }),
      false,
    );
  }
});
