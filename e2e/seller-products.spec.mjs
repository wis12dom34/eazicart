import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `seller-products-${randomUUID()}`,
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

test("seller inventory is private and retains inactive products for management", async ({
  request,
}) => {
  const unauthenticated = await request.get(`${api}/seller/products`);
  expect(unauthenticated.status()).toBe(401);

  const buyerToken = await register(request, "Inventory Buyer");
  const buyerInventory = await request.get(`${api}/seller/products`, {
    headers: headers(buyerToken),
  });
  expect(buyerInventory.status()).toBe(403);
  expect((await buyerInventory.json()).error.code).toBe("SELLER_REQUIRED");

  const sellerOneToken = await register(request, "Inventory Seller One");
  await createSeller(request, sellerOneToken, "ZZZ Inventory Seller One Store");
  const sellerTwoToken = await register(request, "Inventory Seller Two");
  await createSeller(request, sellerTwoToken, "ZZZ Inventory Seller Two Store");

  const sellerOneCreate = await request.post(`${api}/products`, {
    headers: headers(sellerOneToken),
    data: {
      name: "Seller one inventory product",
      price: "12500",
      stock: 5,
      categoryId: "demo-category-fashion",
    },
  });
  expect(sellerOneCreate.status()).toBe(201);
  const sellerOneProduct = (await sellerOneCreate.json()).data;

  const sellerTwoCreate = await request.post(`${api}/products`, {
    headers: headers(sellerTwoToken),
    data: {
      name: "Seller two inventory product",
      price: "9800",
      stock: 9,
      categoryId: "demo-category-fashion",
    },
  });
  expect(sellerTwoCreate.status()).toBe(201);
  const sellerTwoProduct = (await sellerTwoCreate.json()).data;

  const sellerOneInventory = await request.get(`${api}/seller/products`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneInventory.status()).toBe(200);
  expect((await sellerOneInventory.json()).data).toEqual([
    expect.objectContaining({
      id: sellerOneProduct.id,
      name: "Seller one inventory product",
      active: true,
      stock: 5,
    }),
  ]);

  const crossSellerUpdate = await request.patch(
    `${api}/products/${sellerOneProduct.id}`,
    {
      headers: headers(sellerTwoToken),
      data: { stock: 99 },
    },
  );
  expect(crossSellerUpdate.status()).toBe(403);
  expect((await crossSellerUpdate.json()).error.code).toBe("FORBIDDEN");

  const sellerOneUpdate = await request.patch(
    `${api}/products/${sellerOneProduct.id}`,
    {
      headers: headers(sellerOneToken),
      data: { price: "13500", stock: 4 },
    },
  );
  expect(sellerOneUpdate.status()).toBe(200);
  expect((await sellerOneUpdate.json()).data).toEqual(
    expect.objectContaining({ price: "13500", stock: 4 }),
  );

  const deactivate = await request.delete(
    `${api}/products/${sellerOneProduct.id}`,
    { headers: headers(sellerOneToken) },
  );
  expect(deactivate.status()).toBe(204);

  const sellerOneAfterDeactivate = await request.get(`${api}/seller/products`, {
    headers: headers(sellerOneToken),
  });
  expect(sellerOneAfterDeactivate.status()).toBe(200);
  expect((await sellerOneAfterDeactivate.json()).data).toEqual([
    expect.objectContaining({
      id: sellerOneProduct.id,
      active: false,
      price: "13500",
      stock: 4,
    }),
  ]);

  const publicInactiveProduct = await request.get(
    `${api}/products/${sellerOneProduct.id}`,
  );
  expect(publicInactiveProduct.status()).toBe(404);

  const sellerTwoInventory = await request.get(`${api}/seller/products`, {
    headers: headers(sellerTwoToken),
  });
  expect(sellerTwoInventory.status()).toBe(200);
  expect((await sellerTwoInventory.json()).data).toEqual([
    expect.objectContaining({ id: sellerTwoProduct.id, active: true }),
  ]);

  const sellerTwoCleanup = await request.delete(
    `${api}/products/${sellerTwoProduct.id}`,
    { headers: headers(sellerTwoToken) },
  );
  expect(sellerTwoCleanup.status()).toBe(204);
});

test("seller can create edit and deactivate a product from the workspace", async ({
  page,
}) => {
  const email = `seller-products-ui-${randomUUID()}@eazicart.invalid`;
  const password = `seller-products-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Seller Products UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await expect(
    page.getByRole("heading", { name: "Start selling on EaziCart" }),
  ).toBeVisible();
  await page.getByLabel("Store name").fill("Seller Products UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Seller Products UI Store",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Manage products/ }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Product name").fill("UI Inventory Product");
  await page.getByLabel("Price (NGN)").fill("15750");
  await page.getByLabel("Stock").fill("8");
  await page.getByLabel("Category").selectOption({ label: "Fashion" });
  await page.getByLabel("Description").fill("Real product created by UI test");
  await page.getByRole("button", { name: "Create product" }).click();

  let productCard = page
    .getByRole("article")
    .filter({ hasText: "UI Inventory Product" });
  await expect(productCard).toBeVisible();
  await expect(productCard.getByText("Active", { exact: true })).toBeVisible();
  await expect(productCard.getByText("₦15,750", { exact: true })).toBeVisible();
  await expect(
    productCard.getByText("8 in stock", { exact: true }),
  ).toBeVisible();

  await productCard.getByRole("button", { name: "Edit" }).click();
  await productCard.getByLabel("Price (NGN)").fill("16250");
  await productCard.getByLabel("Stock").fill("11");
  await productCard.getByRole("button", { name: "Save changes" }).click();

  productCard = page
    .getByRole("article")
    .filter({ hasText: "UI Inventory Product" });
  await expect(productCard.getByText("₦16,250", { exact: true })).toBeVisible();
  await expect(
    productCard.getByText("11 in stock", { exact: true }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await productCard.getByRole("button", { name: "Deactivate" }).click();

  productCard = page
    .getByRole("article")
    .filter({ hasText: "UI Inventory Product" });
  await expect(
    productCard.getByText("Inactive", { exact: true }),
  ).toBeVisible();
  await expect(
    productCard.getByRole("button", { name: "Deactivate" }),
  ).toHaveCount(0);
});
