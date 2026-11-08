import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";
import { allowedSellerFulfillmentActions } from "../src/lib/seller-fulfillment";

const previousFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = previousFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("seller fulfillment action options exactly mirror permitted backend transitions", () => {
  assert.deepEqual(
    allowedSellerFulfillmentActions("PENDING").map((action) => action.status),
    ["CONFIRMED", "CANCELLED"],
  );
  assert.deepEqual(
    allowedSellerFulfillmentActions("CONFIRMED").map((action) => action.status),
    ["FULFILLED", "CANCELLED"],
  );
  assert.deepEqual(allowedSellerFulfillmentActions("FULFILLED"), []);
  assert.deepEqual(allowedSellerFulfillmentActions("CANCELLED"), []);
  assert.equal(
    allowedSellerFulfillmentActions("PENDING")[1]?.destructive,
    true,
  );
});

test("signed-out buyers cannot inspect or modify seller fulfillment", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json({});
  };
  await assert.rejects(api.ownSellerOrder("order-1"), ApiError);
  await assert.rejects(
    api.updateSellerOrderStatus("order-1", "CONFIRMED"),
    ApiError,
  );
  assert.equal(calls, 0);
});

test("seller order read and fulfillment PATCH use exact bearer token, encoded id, and status", async () => {
  setAccessToken("synthetic-seller");
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer synthetic-seller",
    );
    requests.push({
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return json({ data: { id: "order/1", status: "CONFIRMED" } });
  };
  const id = "order/1";
  await api.ownSellerOrder(id);
  await api.updateSellerOrderStatus(id, "CONFIRMED");
  assert.deepEqual(requests, [
    { method: "GET", path: "/api/seller/orders/order%2F1", body: undefined },
    {
      method: "PATCH",
      path: "/api/seller/orders/order%2F1/fulfillment",
      body: { status: "CONFIRMED" },
    },
  ]);
});

test("payment not confirmed and invalid transitions remain server errors", async () => {
  setAccessToken("synthetic-seller");
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "PAYMENT_NOT_CONFIRMED",
          message:
            "Seller fulfillment cannot start before payment is confirmed",
        },
      },
      409,
    );
  await assert.rejects(
    api.updateSellerOrderStatus("order-1", "FULFILLED"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "PAYMENT_NOT_CONFIRMED",
  );
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "INVALID_FULFILLMENT_TRANSITION",
          message: "Cannot update order status",
        },
      },
      409,
    );
  await assert.rejects(
    api.updateSellerOrderStatus("order-1", "CANCELLED"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "INVALID_FULFILLMENT_TRANSITION",
  );
});
