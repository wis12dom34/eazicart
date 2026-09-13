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
});
