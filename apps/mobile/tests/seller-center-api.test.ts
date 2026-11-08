import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";

const prior = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = prior;
  setAccessToken(null);
  setRefreshHandler(null);
});

test("seller center endpoints reject signed-out access before any fetch", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}");
  };
  for (const invoke of [
    api.ownSellerProfile,
    api.sellerDashboard,
    api.ownSellerProducts,
    api.ownSellerOrders,
  ]) {
    await assert.rejects(
      invoke(),
      (error: unknown) =>
        error instanceof ApiError && error.code === "LOGIN_REQUIRED",
    );
  }
  assert.equal(calls, 0);
});

test("seller dashboard, inventory and store orders use authenticated seller-scoped GET routes", async () => {
  setAccessToken("synthetic-owner-token");
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-owner-token",
    );
    seen.push(url.pathname);
    return new Response(JSON.stringify({ data: { id: "seller-fixture" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  await api.ownSellerProfile();
  await api.sellerDashboard();
  await api.ownSellerProducts();
  await api.ownSellerOrders();
  assert.deepEqual(seen, [
    "/api/seller-profile",
    "/api/seller/dashboard",
    "/api/seller/products",
    "/api/seller/orders",
  ]);
});

test("seller-only 403 stays an access error rather than exposing other accounts", async () => {
  setAccessToken("synthetic-customer-token");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "SELLER_REQUIRED",
          message: "Create a seller profile first",
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  await assert.rejects(
    api.sellerDashboard(),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 403 &&
      error.code === "SELLER_REQUIRED",
  );
});
