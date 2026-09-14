import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `fulfillment-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).tokens.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

async function createSeller(request, token, displayName) {
  const response = await request.post(`${api}/seller-profile`, {
    headers: headers(token),
    data: { displayName },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function createProduct(request, token, name, price) {
  const response = await request.post(`${api}/products`, {
    headers: headers(token),
    data: {
      name,
      price,
      stock: 10,
      categoryId: "demo-category-fashion",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function createMixedOrder(request, buyerToken, products) {
  const address = await request.post(`${api}/addresses`, {
    headers: headers(buyerToken),
    data: {
      label: "Fulfillment test",
      line1: "10 Fulfillment Lane",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  const addressId = (await address.json()).data.id;

  for (const product of products) {
    const cart = await request.post(`${api}/cart/items`, {
      headers: headers(buyerToken),
      data: { productId: product.id, quantity: 1 },
    });
    expect(cart.status()).toBe(201);
  }

  const order = await request.post(`${api}/orders`, {
    headers: headers(buyerToken),
    data: { addressId },
  });
  expect(order.status()).toBe(201);
  return (await order.json()).data;
}

test("seller fulfillment status is isolated per seller and never mutates buyer order status", async ({
  request,
}) => {
  const buyerToken = await register(request, "Fulfillment Buyer");
  const sellerOneToken = await register(request, "Fulfillment Seller One");
  const sellerTwoToken = await register(request, "Fulfillment Seller Two");
  await createSeller(request, sellerOneToken, "Fulfillment Seller One Store");
  await createSeller(request, sellerTwoToken, "Fulfillment Seller Two Store");
  const productOne = await createProduct(
    request,
    sellerOneToken,
    "Fulfillment product one",
    "12000",
  );
  const productTwo = await createProduct(
    request,
    sellerTwoToken,
    "Fulfillment product two",
    "9000",
  );
  const order = await createMixedOrder(request, buyerToken, [
    productOne,
    productTwo,
  ]);

  const sellerOneInitial = await request.get(`${api}/seller/orders/${order.id}`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneInitial.status()).toBe(200);
  expect((await sellerOneInitial.json()).data).toEqual(
    expect.objectContaining({ status: "PENDING", globalStatus: "PENDING" }),
  );

  const sellerTwoInitial = await request.get(`${api}/seller/orders/${order.id}`, {
    headers: headers(sellerTwoToken),
  });
  expect(sellerTwoInitial.status()).toBe(200);
  expect((await sellerTwoInitial.json()).data.status).toBe("PENDING");

  const skipAhead = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerOneToken),
      data: { status: "FULFILLED" },
    },
  );
  expect(skipAhead.status()).toBe(409);
  expect((await skipAhead.json()).error.code).toBe(
    "INVALID_FULFILLMENT_TRANSITION",
  );

  const confirmed = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerOneToken),
      data: { status: "CONFIRMED" },
    },
  );
  expect(confirmed.status()).toBe(200);
  expect((await confirmed.json()).data.status).toBe("CONFIRMED");

  const sellerTwoStillPending = await request.get(
    `${api}/seller/orders/${order.id}`,
    { headers: headers(sellerTwoToken) },
  );
  expect(sellerTwoStillPending.status()).toBe(200);
  expect((await sellerTwoStillPending.json()).data.status).toBe("PENDING");

  const buyerAfterConfirm = await request.get(`${api}/orders/${order.id}`, {
    headers: headers(buyerToken),
  });
  expect(buyerAfterConfirm.status()).toBe(200);
  expect((await buyerAfterConfirm.json()).data.status).toBe("PENDING");

  const fulfilled = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerOneToken),
      data: { status: "FULFILLED" },
    },
  );
  expect(fulfilled.status()).toBe(200);
  expect((await fulfilled.json()).data.status).toBe("FULFILLED");

  const cannotReopen = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerOneToken),
      data: { status: "CONFIRMED" },
    },
  );
  expect(cannotReopen.status()).toBe(409);

  const sellerTwoCancelled = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerTwoToken),
      data: { status: "CANCELLED" },
    },
  );
  expect(sellerTwoCancelled.status()).toBe(200);
  expect((await sellerTwoCancelled.json()).data.status).toBe("CANCELLED");

  const buyerFinal = await request.get(`${api}/orders/${order.id}`, {
    headers: headers(buyerToken),
  });
  expect(buyerFinal.status()).toBe(200);
  expect((await buyerFinal.json()).data.status).toBe("PENDING");

  const sellerOneDashboard = await request.get(`${api}/seller/dashboard`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneDashboard.status()).toBe(200);
  expect((await sellerOneDashboard.json()).data.orders).toEqual({
    total: 1,
    pending: 0,
    confirmed: 0,
    fulfilled: 1,
    cancelled: 0,
  });

  const sellerTwoDashboard = await request.get(`${api}/seller/dashboard`, {
    headers: headers(sellerTwoToken),
  });
  expect(sellerTwoDashboard.status()).toBe(200);
  expect((await sellerTwoDashboard.json()).data.orders).toEqual({
    total: 1,
    pending: 0,
    confirmed: 0,
    fulfilled: 0,
    cancelled: 1,
  });
});

test("seller can confirm and fulfill their own order from the workspace", async ({
  page,
  request,
}) => {
  const email = `fulfillment-ui-${randomUUID()}@eazicart.invalid`;
  const password = `fulfillment-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Fulfillment UI Seller");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await page.getByLabel("Store name").fill("Fulfillment UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();
  const sellerToken = await page.evaluate(() => {
    const raw = localStorage.getItem("eazicart.auth.tokens");
    return raw ? JSON.parse(raw).accessToken : null;
  });
  expect(sellerToken).toBeTruthy();

  const product = await createProduct(
    request,
    sellerToken,
    "Fulfillment UI product",
    "15500",
  );
  const buyerToken = await register(request, "Fulfillment UI Buyer");
  const order = await createMixedOrder(request, buyerToken, [product]);

  await page.goto(`/seller/orders/${order.id}`);
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm fulfillment" }).click();
  await expect(
    page.getByText("Fulfillment updated to Confirmed."),
  ).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark fulfilled" }).click();
  await expect(
    page.getByText("Fulfillment updated to Fulfilled."),
  ).toBeVisible();
  await expect(page.getByText("Fulfilled", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your fulfillment is complete and cannot be moved backward."),
  ).toBeVisible();

  const buyerOrder = await request.get(`${api}/orders/${order.id}`, {
    headers: headers(buyerToken),
  });
  expect(buyerOrder.status()).toBe(200);
  expect((await buyerOrder.json()).data.status).toBe("PENDING");
});
