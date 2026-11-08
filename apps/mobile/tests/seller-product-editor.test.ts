import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";
import { validateSellerProductDraft } from "../src/lib/product-form";

const base = {
  name: " Sport shoes ",
  description: " Comfortable shoes ",
  price: "4500.25",
  stock: "12",
  categoryId: "category-1",
};
const previous = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = previous;
  setAccessToken(null);
  setRefreshHandler(null);
});

test("seller draft normalizes input before requesting backend", () => {
  const result = validateSellerProductDraft(base);
  assert.deepEqual(result, {
    ok: true,
    data: {
      name: "Sport shoes",
      description: "Comfortable shoes",
      price: "4500.25",
      stock: 12,
      categoryId: "category-1",
    },
  });
});

test("seller draft rejects invalid name, price, stock, and category", () => {
  const invalid = [
    { ...base, name: "x" },
    { ...base, price: "-10" },
    { ...base, price: "1.333" },
    { ...base, price: "1e6" },
    { ...base, price: "NaN" },
    { ...base, price: "99999999999" },
    { ...base, stock: "-1" },
    { ...base, stock: "1.5" },
    { ...base, stock: "999999999999999999" },
    { ...base, categoryId: " " },
  ];
  for (const draft of invalid) {
    assert.equal(
      validateSellerProductDraft(draft).ok,
      false,
      JSON.stringify(draft),
    );
  }
});

test("seller product changes require bearer auth; public categories do not", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    assert.equal(new URL(String(input)).pathname, "/api/categories");
    return new Response(JSON.stringify({ data: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const valid = validateSellerProductDraft(base);
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  await assert.rejects(api.createSellerProduct(valid.data), ApiError);
  await assert.rejects(
    api.updateSellerProduct("product-1", valid.data),
    ApiError,
  );
  await assert.rejects(api.archiveSellerProduct("product-1"), ApiError);
  await api.categories();
  assert.equal(calls, 1);
});

test("seller create and edit send validated fields without deleting images", async () => {
  setAccessToken("synthetic-owner-token");
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-owner-token",
    );
    requests.push({
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify({ data: { id: "product-1" } }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const valid = validateSellerProductDraft(base);
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  await api.createSellerProduct(valid.data);
  await api.updateSellerProduct("product-1", valid.data);
  await api.archiveSellerProduct("product-1");
  assert.equal(requests.length, 3);
  assert.deepEqual(
    requests.map((r) => [r.method, r.path]),
    [
      ["POST", "/api/products"],
      ["PATCH", "/api/products/product-1"],
      ["DELETE", "/api/products/product-1"],
    ],
  );
  assert.equal(
    requests[0]?.body && Object.hasOwn(requests[0].body, "images"),
    false,
  );
  assert.equal(
    requests[1]?.body && Object.hasOwn(requests[1].body, "images"),
    false,
  );
  assert.equal(requests[2]?.body, undefined);
});

test("backend owner rejection is surfaced without retrying another seller product", async () => {
  setAccessToken("synthetic-seller-token");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: "You do not own this product" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  await assert.rejects(
    api.updateSellerProduct("other-seller-product", { stock: 3 }),
    (e: unknown) =>
      e instanceof ApiError && e.status === 403 && e.code === "FORBIDDEN",
  );
});
