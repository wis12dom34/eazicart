import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { markOrderPaid } from "./helpers/paid-order.mjs";

const api = "http://localhost:3001";

async function register(request, name) {
  const email = `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`;
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email,
      name,
      password: `seller-customers-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { token: body.tokens.accessToken, user: body.user, email };
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

async function createProduct(request, token, name, price, stock = 10) {
  const response = await request.post(`${api}/products`, {
    headers: headers(token),
    data: {
      name,
      price,
      stock,
      categoryId: "demo-category-fashion",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function createBuyerOrder(request, buyerToken, items) {
  const addressResponse = await request.post(`${api}/addresses`, {
    headers: headers(buyerToken),
    data: {
      label: "Office",
      line1: "71 Private Customer Test Road",
      city: "Abuja",
      region: "FCT",
      postalCode: "900001",
      country: "Nigeria",
    },
  });
  expect(addressResponse.status()).toBe(201);
  const addressId = (await addressResponse.json()).data.id;

  for (const item of items) {
    const cartResponse = await request.post(`${api}/cart/items`, {
      headers: headers(buyerToken),
      data: { productId: item.productId, quantity: item.quantity },
    });
    expect(cartResponse.status()).toBe(201);
  }

  const orderResponse = await request.post(`${api}/orders`, {
    headers: headers(buyerToken),
    data: { addressId },
  });
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()).data;
  await markOrderPaid(order.id);
  return order;
}

test("seller customer endpoints expose only real seller relationships", async ({
  request,
}) => {
  const unauthenticated = await request.get(`${api}/seller/customers`);
  expect(unauthenticated.status()).toBe(401);

  const buyer = await register(request, "Seller Customer Buyer");
  const buyerCustomers = await request.get(`${api}/seller/customers`, {
    headers: headers(buyer.token),
  });
  expect(buyerCustomers.status()).toBe(403);
  expect((await buyerCustomers.json()).error.code).toBe("SELLER_REQUIRED");

  const sellerOne = await register(request, "Customer Seller One");
  await createSeller(request, sellerOne.token, "ZZZ Customer Seller One Store");
  const sellerOneProduct = await createProduct(
    request,
    sellerOne.token,
    "Seller one customer product",
    "12000",
  );

  const sellerTwo = await register(request, "Customer Seller Two");
  await createSeller(request, sellerTwo.token, "ZZZ Customer Seller Two Store");
  const sellerTwoProduct = await createProduct(
    request,
    sellerTwo.token,
    "Seller two customer product",
    "9000",
  );

  const mixedOrder = await createBuyerOrder(request, buyer.token, [
    { productId: sellerOneProduct.id, quantity: 2 },
    { productId: sellerTwoProduct.id, quantity: 1 },
  ]);
  const repeatOrder = await createBuyerOrder(request, buyer.token, [
    { productId: sellerOneProduct.id, quantity: 1 },
  ]);

  const sellerOneListResponse = await request.get(`${api}/seller/customers`, {
    headers: headers(sellerOne.token),
  });
  expect(sellerOneListResponse.status()).toBe(200);
  const sellerOneCustomers = (await sellerOneListResponse.json()).data;
  expect(sellerOneCustomers).toHaveLength(1);
  expect(sellerOneCustomers[0]).toEqual(
    expect.objectContaining({
      id: buyer.user.id,
      name: "Seller Customer Buyer",
      orders: 2,
      units: 3,
      location: { city: "Abuja", region: "FCT", country: "Nigeria" },
    }),
  );
  const sellerOneSerialized = JSON.stringify(sellerOneCustomers[0]);
  expect(sellerOneSerialized).not.toContain(buyer.email);
  expect(sellerOneSerialized).not.toContain("71 Private Customer Test Road");
  expect(sellerOneSerialized).not.toContain("900001");
  expect(sellerOneSerialized).not.toContain("Seller two customer product");

  const sellerOneDetailResponse = await request.get(
    `${api}/seller/customers/${buyer.user.id}`,
    { headers: headers(sellerOne.token) },
  );
  expect(sellerOneDetailResponse.status()).toBe(200);
  const sellerOneDetail = (await sellerOneDetailResponse.json()).data;
  expect(sellerOneDetail.customer.orders).toBe(2);
  expect(sellerOneDetail.customer.units).toBe(3);
  expect(sellerOneDetail.orders.map((order) => order.id)).toEqual([
    repeatOrder.id,
    mixedOrder.id,
  ]);
  expect(sellerOneDetail.orders.flatMap((order) => order.items)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        productName: "Seller one customer product",
      }),
    ]),
  );
  const sellerOneDetailSerialized = JSON.stringify(sellerOneDetail);
  expect(sellerOneDetailSerialized).not.toContain(buyer.email);
  expect(sellerOneDetailSerialized).not.toContain(
    "Seller two customer product",
  );
  expect(sellerOneDetailSerialized).not.toContain(
    "71 Private Customer Test Road",
  );

  const sellerTwoListResponse = await request.get(`${api}/seller/customers`, {
    headers: headers(sellerTwo.token),
  });
  expect(sellerTwoListResponse.status()).toBe(200);
  const sellerTwoCustomers = (await sellerTwoListResponse.json()).data;
  expect(sellerTwoCustomers).toHaveLength(1);
  expect(sellerTwoCustomers[0]).toEqual(
    expect.objectContaining({
      id: buyer.user.id,
      orders: 1,
      units: 1,
    }),
  );

  const unrelated = await register(request, "Unrelated Customer Seller");
  await createSeller(
    request,
    unrelated.token,
    "ZZZ Unrelated Customer Seller Store",
  );
  const unrelatedListResponse = await request.get(`${api}/seller/customers`, {
    headers: headers(unrelated.token),
  });
  expect(unrelatedListResponse.status()).toBe(200);
  expect((await unrelatedListResponse.json()).data).toEqual([]);

  const unrelatedDetail = await request.get(
    `${api}/seller/customers/${buyer.user.id}`,
    { headers: headers(unrelated.token) },
  );
  expect(unrelatedDetail.status()).toBe(404);
  expect((await unrelatedDetail.json()).error.code).toBe("CUSTOMER_NOT_FOUND");

  for (const [token, productId] of [
    [sellerOne.token, sellerOneProduct.id],
    [sellerTwo.token, sellerTwoProduct.id],
  ]) {
    const cleanup = await request.delete(`${api}/products/${productId}`, {
      headers: headers(token),
    });
    expect(cleanup.status()).toBe(204);
  }
});

test("seller workspace renders customer list and privacy-safe detail", async ({
  page,
  request,
}) => {
  const email = `seller-customers-ui-${randomUUID()}@eazicart.invalid`;
  const password = `seller-customers-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Seller Customers UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await page.getByLabel("Store name").fill("Seller Customers UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Seller Customers UI Store",
      exact: true,
    }),
  ).toBeVisible();

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem("eazicart.auth.tokens");
    return raw ? JSON.parse(raw).accessToken : null;
  });
  expect(token).toBeTruthy();

  const product = await createProduct(
    request,
    token,
    "Seller UI customer product",
    "14500",
  );
  const buyer = await register(request, "Seller UI Customer Buyer");
  const order = await createBuyerOrder(request, buyer.token, [
    { productId: product.id, quantity: 2 },
  ]);

  await page.goto("/seller/dashboard");
  await page.getByRole("link", { name: "Manage customers" }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/customers");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByText("Seller UI Customer Buyer")).toBeVisible();
  await expect(page.getByText("Abuja, FCT, Nigeria")).toBeVisible();
  await expect(page.getByText(buyer.email)).toHaveCount(0);
  await expect(page.getByText("71 Private Customer Test Road")).toHaveCount(0);

  await page.getByRole("link", { name: /Seller UI Customer Buyer/ }).click();
  await expect(
    page.getByRole("heading", { name: "Seller UI Customer Buyer" }),
  ).toBeVisible();
  await expect(page.getByText(`Order #${order.id.slice(-8)}`)).toBeVisible();
  await expect(page.getByText("Seller UI customer product × 2")).toBeVisible();
  await expect(page.getByText(buyer.email)).toHaveCount(0);
  await expect(page.getByText("71 Private Customer Test Road")).toHaveCount(0);
  await expect(page.getByText("900001")).toHaveCount(0);

  const cleanup = await request.delete(`${api}/products/${product.id}`, {
    headers: headers(token),
  });
  expect(cleanup.status()).toBe(204);
});
