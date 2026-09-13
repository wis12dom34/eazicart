import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `seller-orders-${randomUUID()}`,
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
      line1: "25 Seller Order Test Road",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
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
  return (await orderResponse.json()).data;
}

test("seller order endpoints isolate mixed-seller orders", async ({ request }) => {
  const unauthenticated = await request.get(`${api}/seller/orders`);
  expect(unauthenticated.status()).toBe(401);

  const buyerToken = await register(request, "Seller Orders Buyer");
  const buyerSellerOrders = await request.get(`${api}/seller/orders`, {
    headers: headers(buyerToken),
  });
  expect(buyerSellerOrders.status()).toBe(403);
  expect((await buyerSellerOrders.json()).error.code).toBe("SELLER_REQUIRED");

  const sellerOneToken = await register(request, "Order Seller One");
  await createSeller(request, sellerOneToken, "ZZZ Order Seller One Store");
  const sellerOneProduct = await createProduct(
    request,
    sellerOneToken,
    "Seller one private order product",
    "12000",
  );

  const sellerTwoToken = await register(request, "Order Seller Two");
  await createSeller(request, sellerTwoToken, "ZZZ Order Seller Two Store");
  const sellerTwoProduct = await createProduct(
    request,
    sellerTwoToken,
    "Seller two private order product",
    "9000",
  );

  const order = await createBuyerOrder(request, buyerToken, [
    { productId: sellerOneProduct.id, quantity: 2 },
    { productId: sellerTwoProduct.id, quantity: 1 },
  ]);

  const sellerOneList = await request.get(`${api}/seller/orders`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneList.status()).toBe(200);
  const sellerOneOrders = (await sellerOneList.json()).data;
  expect(sellerOneOrders).toHaveLength(1);
  expect(sellerOneOrders[0]).toEqual(
    expect.objectContaining({
      id: order.id,
      subtotal: "24000",
      customer: { name: "Seller Orders Buyer" },
      items: [
        expect.objectContaining({
          productName: "Seller one private order product",
          quantity: 2,
          unitPrice: "12000",
        }),
      ],
    }),
  );
  expect(JSON.stringify(sellerOneOrders[0])).not.toContain(
    "Seller two private order product",
  );
  expect(JSON.stringify(sellerOneOrders[0])).not.toContain("@eazicart.invalid");

  const sellerOneDetail = await request.get(
    `${api}/seller/orders/${order.id}`,
    { headers: headers(sellerOneToken) },
  );
  expect(sellerOneDetail.status()).toBe(200);
  const sellerOneData = (await sellerOneDetail.json()).data;
  expect(sellerOneData.subtotal).toBe("24000");
  expect(sellerOneData.items).toHaveLength(1);
  expect(sellerOneData.address.line1).toBe("25 Seller Order Test Road");

  const sellerTwoDetail = await request.get(
    `${api}/seller/orders/${order.id}`,
    { headers: headers(sellerTwoToken) },
  );
  expect(sellerTwoDetail.status()).toBe(200);
  const sellerTwoData = (await sellerTwoDetail.json()).data;
  expect(sellerTwoData.subtotal).toBe("9000");
  expect(sellerTwoData.items).toEqual([
    expect.objectContaining({
      productName: "Seller two private order product",
      quantity: 1,
    }),
  ]);
  expect(JSON.stringify(sellerTwoData)).not.toContain(
    "Seller one private order product",
  );

  const unrelatedToken = await register(request, "Unrelated Order Seller");
  await createSeller(request, unrelatedToken, "ZZZ Unrelated Order Seller Store");
  const unrelatedDetail = await request.get(
    `${api}/seller/orders/${order.id}`,
    { headers: headers(unrelatedToken) },
  );
  expect(unrelatedDetail.status()).toBe(404);

  for (const [token, productId] of [
    [sellerOneToken, sellerOneProduct.id],
    [sellerTwoToken, sellerTwoProduct.id],
  ]) {
    const cleanup = await request.delete(`${api}/products/${productId}`, {
      headers: headers(token),
    });
    expect(cleanup.status()).toBe(204);
  }
});

test("seller workspace renders seller-only order list and detail", async ({
  page,
  request,
}) => {
  const email = `seller-orders-ui-${randomUUID()}@eazicart.invalid`;
  const password = `seller-orders-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Seller Orders UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await page.getByLabel("Store name").fill("Seller Orders UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Seller Orders UI Store", exact: true }),
  ).toBeVisible();

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem("eazicart.auth.tokens");
    return raw ? JSON.parse(raw).accessToken : null;
  });
  expect(token).toBeTruthy();

  const product = await createProduct(
    request,
    token,
    "Seller UI order product",
    "14500",
  );
  const buyerToken = await register(request, "Seller UI Order Customer");
  const order = await createBuyerOrder(request, buyerToken, [
    { productId: product.id, quantity: 2 },
  ]);

  await page.goto("/seller/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByText("Seller UI Order Customer")).toBeVisible();
  await expect(page.getByText("₦29,000", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`Order #${order.id.slice(-8)}`) }).click();

  await expect(
    page.getByRole("heading", { name: `Order #${order.id.slice(-8)}` }),
  ).toBeVisible();
  await expect(page.getByText("Seller UI order product")).toBeVisible();
  await expect(page.getByText("Seller UI Order Customer")).toBeVisible();
  await expect(page.getByText("25 Seller Order Test Road")).toBeVisible();
  await expect(page.getByText("Status is read-only")).toBeVisible();

  const cleanup = await request.delete(`${api}/products/${product.id}`, {
    headers: headers(token),
  });
  expect(cleanup.status()).toBe(204);
});
