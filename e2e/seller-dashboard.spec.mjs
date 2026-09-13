import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `seller-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).tokens.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

test("seller dashboard exposes only real metrics for the authenticated seller", async ({
  request,
}) => {
  const unauthenticated = await request.get(`${api}/seller/dashboard`);
  expect(unauthenticated.status()).toBe(401);

  const buyerToken = await register(request, "Dashboard Buyer");
  const buyerProfile = await request.get(`${api}/seller-profile`, {
    headers: headers(buyerToken),
  });
  expect(buyerProfile.status()).toBe(200);
  expect((await buyerProfile.json()).data).toBeNull();

  const buyerDashboard = await request.get(`${api}/seller/dashboard`, {
    headers: headers(buyerToken),
  });
  expect(buyerDashboard.status()).toBe(403);
  expect((await buyerDashboard.json()).error.code).toBe("SELLER_REQUIRED");

  const sellerOneToken = await register(request, "Seller One");
  const sellerOneProfile = await request.post(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
    data: { displayName: "Seller One Store" },
  });
  expect(sellerOneProfile.status()).toBe(201);

  const currentSellerProfile = await request.get(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
  });
  expect(currentSellerProfile.status()).toBe(200);
  expect((await currentSellerProfile.json()).data).toEqual(
    expect.objectContaining({ displayName: "Seller One Store" }),
  );

  const sellerOneProduct = await request.post(`${api}/products`, {
    headers: headers(sellerOneToken),
    data: {
      name: "Seller one dashboard product",
      price: "12500",
      stock: 7,
      categoryId: "demo-category-fashion",
    },
  });
  expect(sellerOneProduct.status()).toBe(201);
  const sellerOneProductId = (await sellerOneProduct.json()).data.id;

  const sellerTwoToken = await register(request, "Seller Two");
  const sellerTwoProfile = await request.post(`${api}/seller-profile`, {
    headers: headers(sellerTwoToken),
    data: { displayName: "Seller Two Store" },
  });
  expect(sellerTwoProfile.status()).toBe(201);

  const sellerTwoProduct = await request.post(`${api}/products`, {
    headers: headers(sellerTwoToken),
    data: {
      name: "Seller two dashboard product",
      price: "9000",
      stock: 3,
      categoryId: "demo-category-fashion",
    },
  });
  expect(sellerTwoProduct.status()).toBe(201);
  const sellerTwoProductId = (await sellerTwoProduct.json()).data.id;

  const address = await request.post(`${api}/addresses`, {
    headers: headers(buyerToken),
    data: {
      label: "Home",
      line1: "1 Seller Dashboard Test Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  const addressId = (await address.json()).data.id;

  const cart = await request.post(`${api}/cart/items`, {
    headers: headers(buyerToken),
    data: { productId: sellerOneProductId, quantity: 2 },
  });
  expect(cart.status()).toBe(201);

  const order = await request.post(`${api}/orders`, {
    headers: headers(buyerToken),
    data: { addressId },
  });
  expect(order.status()).toBe(201);

  const sellerOneDashboard = await request.get(`${api}/seller/dashboard`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneDashboard.status()).toBe(200);
  expect((await sellerOneDashboard.json()).data).toEqual({
    seller: expect.objectContaining({ displayName: "Seller One Store" }),
    inventory: {
      totalProducts: 1,
      activeProducts: 1,
      outOfStockProducts: 0,
      unitsInStock: 7,
    },
    orders: {
      total: 1,
      pending: 1,
      confirmed: 0,
      fulfilled: 0,
      cancelled: 0,
    },
    customers: { total: 1 },
    analytics: {
      revenue: null,
      productViews: null,
      impressions: null,
      profileVisits: null,
      clicks: null,
      conversionRate: null,
    },
  });

  const sellerTwoDashboard = await request.get(`${api}/seller/dashboard`, {
    headers: headers(sellerTwoToken),
  });
  expect(sellerTwoDashboard.status()).toBe(200);
  const sellerTwoData = (await sellerTwoDashboard.json()).data;
  expect(sellerTwoData.inventory).toEqual({
    totalProducts: 1,
    activeProducts: 1,
    outOfStockProducts: 0,
    unitsInStock: 3,
  });
  expect(sellerTwoData.orders).toEqual({
    total: 0,
    pending: 0,
    confirmed: 0,
    fulfilled: 0,
    cancelled: 0,
  });
  expect(sellerTwoData.customers).toEqual({ total: 0 });

  const sellerOneCleanup = await request.delete(
    `${api}/products/${sellerOneProductId}`,
    { headers: headers(sellerOneToken) },
  );
  expect(sellerOneCleanup.status()).toBe(204);
  const sellerTwoCleanup = await request.delete(
    `${api}/products/${sellerTwoProductId}`,
    { headers: headers(sellerTwoToken) },
  );
  expect(sellerTwoCleanup.status()).toBe(204);
});

test("seller workspace lets an authenticated customer create a store without fake analytics", async ({
  page,
}) => {
  const email = `seller-ui-${randomUUID()}@eazicart.invalid`;
  const password = `seller-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Seller UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/profile");
  await page.getByRole("link", { name: /Seller workspace/ }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/dashboard");
  await expect(
    page.getByRole("heading", { name: "Start selling on EaziCart" }),
  ).toBeVisible();
  await expect(page.getByLabel("Store name")).toHaveValue("Seller UI Owner");

  await page.getByLabel("Store name").fill("Seller UI Store");
  await page.getByLabel(/Store bio/).fill("Independent seller test store");
  await page.getByRole("button", { name: "Create seller profile" }).click();

  await expect(
    page.getByRole("heading", { name: "Seller UI Store", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Real operational data from your EaziCart store.")).toBeVisible();
  await expect(page.getByText("Nothing is estimated or fabricated here.")).toBeVisible();
  await expect(page.getByText("Not available yet")).toHaveCount(6);
  await expect(page.getByRole("link", { name: /View store/ })).toHaveAttribute(
    "href",
    /^\/seller\//,
  );
});
