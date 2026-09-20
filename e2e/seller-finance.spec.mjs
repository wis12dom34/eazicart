import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../packages/database/dist/index.js";
import { markOrderPaid } from "./helpers/paid-order.mjs";

const api = process.env.E2E_API_BASE ?? "http://localhost:3001";
const web = process.env.E2E_WEB_BASE ?? "http://localhost:3000";

async function registerAccount(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `finance-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { token: body.tokens.accessToken, user: body.user };
}

async function register(request, name) {
  return (await registerAccount(request, name)).token;
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

async function createAddress(request, token, label = "Finance test") {
  const address = await request.post(`${api}/addresses`, {
    headers: headers(token),
    data: {
      label,
      line1: "11 Finance Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  return (await address.json()).data;
}

async function createOrder(request, buyerToken, productId, quantity = 1) {
  const address = await createAddress(request, buyerToken);

  const cart = await request.post(`${api}/cart/items`, {
    headers: headers(buyerToken),
    data: { productId, quantity },
  });
  expect(cart.status()).toBe(201);

  const order = await request.post(`${api}/orders`, {
    headers: headers(buyerToken),
    data: { addressId: address.id },
  });
  expect(order.status()).toBe(201);
  return (await order.json()).data;
}

async function finance(request, token) {
  const response = await request.get(`${api}/seller/finance`, {
    headers: headers(token),
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

test("seller finance only counts verified paid sales and follows fulfillment state", async ({
  request,
}) => {
  const unauthenticated = await request.get(`${api}/seller/finance`);
  expect(unauthenticated.status()).toBe(401);

  const sellerToken = await register(request, "Finance Seller");
  const beforeProfile = await request.get(`${api}/seller/finance`, {
    headers: headers(sellerToken),
  });
  expect(beforeProfile.status()).toBe(403);
  expect((await beforeProfile.json()).error.code).toBe("SELLER_REQUIRED");

  await createSeller(request, sellerToken, "Finance Seller Store");
  const product = await createProduct(
    request,
    sellerToken,
    "Finance verified product",
    "12500",
  );
  const buyerToken = await register(request, "Finance Buyer");
  const order = await createOrder(request, buyerToken, product.id, 2);

  expect(await finance(request, sellerToken)).toEqual({
    paidOrders: 0,
    totals: [],
    settlement: {
      platformFees: null,
      netEarnings: null,
      availableForPayout: null,
      payoutsEnabled: false,
    },
    recentSales: [],
  });

  await markOrderPaid(order.id);
  const pending = await finance(request, sellerToken);
  expect(pending.paidOrders).toBe(1);
  expect(pending.totals).toEqual([
    {
      currency: "NGN",
      paidGross: "25000",
      pendingGross: "25000",
      confirmedGross: "0",
      fulfilledGross: "0",
      cancelledGross: "0",
    },
  ]);
  expect(pending.recentSales).toHaveLength(1);
  expect(pending.recentSales[0]).toEqual(
    expect.objectContaining({
      orderId: order.id,
      fulfillmentStatus: "PENDING",
      subtotal: "25000",
      currency: "NGN",
    }),
  );

  const confirmed = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerToken),
      data: { status: "CONFIRMED" },
    },
  );
  expect(confirmed.status()).toBe(200);
  expect((await finance(request, sellerToken)).totals[0]).toEqual(
    expect.objectContaining({
      pendingGross: "0",
      confirmedGross: "25000",
      fulfilledGross: "0",
    }),
  );

  const fulfilled = await request.patch(
    `${api}/seller/orders/${order.id}/fulfillment`,
    {
      headers: headers(sellerToken),
      data: { status: "FULFILLED" },
    },
  );
  expect(fulfilled.status()).toBe(200);
  const finalSummary = await finance(request, sellerToken);
  expect(finalSummary.totals[0]).toEqual(
    expect.objectContaining({
      paidGross: "25000",
      pendingGross: "0",
      confirmedGross: "0",
      fulfilledGross: "25000",
      cancelledGross: "0",
    }),
  );
  expect(finalSummary.settlement).toEqual({
    platformFees: null,
    netEarnings: null,
    availableForPayout: null,
    payoutsEnabled: false,
  });
});

test("seller finance totals include verified sales beyond the recent history window", async ({
  request,
}) => {
  const db = new PrismaClient();
  try {
    const sellerToken = await register(request, "Finance History Seller");
    const seller = await createSeller(
      request,
      sellerToken,
      "Finance History Store",
    );
    const product = await createProduct(
      request,
      sellerToken,
      "Finance history product",
      "1000",
    );
    const buyer = await registerAccount(request, "Finance History Buyer");
    const address = await createAddress(
      request,
      buyer.token,
      "Finance history address",
    );

    const sales = Array.from({ length: 101 }, (_, index) => {
      const orderId = `finance-history-order-${randomUUID()}`;
      return {
        orderId,
        reference: `finance-history-payment-${randomUUID()}`,
        createdAt: new Date(Date.now() - index * 1000),
      };
    });

    await db.$transaction([
      db.order.createMany({
        data: sales.map(({ orderId, createdAt }) => ({
          id: orderId,
          status: "CONFIRMED",
          total: "1000",
          userId: buyer.user.id,
          addressId: address.id,
          createdAt,
        })),
      }),
      db.orderItem.createMany({
        data: sales.map(({ orderId }) => ({
          quantity: 1,
          unitPrice: "1000",
          productName: product.name,
          orderId,
          productId: product.id,
        })),
      }),
      db.payment.createMany({
        data: sales.map(({ orderId, reference, createdAt }) => ({
          reference,
          status: "SUCCESS",
          amount: "1000",
          currency: "NGN",
          paidAt: createdAt,
          orderId,
        })),
      }),
      db.sellerFulfillment.createMany({
        data: sales.map(({ orderId }) => ({
          status: "PENDING",
          orderId,
          sellerId: seller.id,
        })),
      }),
    ]);

    const summary = await finance(request, sellerToken);
    expect(summary.paidOrders).toBe(101);
    expect(summary.totals).toEqual([
      {
        currency: "NGN",
        paidGross: "101000",
        pendingGross: "101000",
        confirmedGross: "0",
        fulfilledGross: "0",
        cancelledGross: "0",
      },
    ]);
    expect(summary.recentSales).toHaveLength(20);
  } finally {
    await db.$disconnect();
  }
});

test("seller finance screen shows verified-only empty state and no fake payout balance", async ({
  page,
}) => {
  const email = `finance-ui-${randomUUID()}@eazicart.invalid`;
  const password = `finance-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Finance UI Seller");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${web}/`);

  await page.goto("/seller/dashboard");
  await page.getByLabel("Store name").fill("Finance UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Finance UI Store", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Finance" }).click();
  await expect(page).toHaveURL(`${web}/seller/finance`);

  await expect(
    page.getByRole("heading", { name: "Verified sales only" }),
  ).toBeVisible();
  await expect(page.getByText("No verified paid sales yet")).toBeVisible();
  await expect(page.getByText("Payouts not configured")).toBeVisible();
  await expect(page.getByText("Not available yet")).toHaveCount(3);
  await expect(page.getByText(/Available for payout/)).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
});
