import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `seller-store-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).tokens.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

test("seller storefront updates stay authenticated, validated and owner scoped", async ({
  request,
}) => {
  const unauthenticated = await request.patch(`${api}/seller-profile`, {
    data: { displayName: "Unauthenticated Store" },
  });
  expect(unauthenticated.status()).toBe(401);

  const buyerToken = await register(request, "Storefront Buyer");
  const buyerUpdate = await request.patch(`${api}/seller-profile`, {
    headers: headers(buyerToken),
    data: { displayName: "Buyer Cannot Update" },
  });
  expect(buyerUpdate.status()).toBe(404);
  expect((await buyerUpdate.json()).error.code).toBe("SELLER_NOT_FOUND");

  const sellerOneToken = await register(request, "Storefront Seller One");
  const sellerOneCreate = await request.post(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
    data: {
      displayName: "Storefront One",
      bio: "Original storefront bio",
    },
  });
  expect(sellerOneCreate.status()).toBe(201);
  const sellerOne = (await sellerOneCreate.json()).data;

  const sellerTwoToken = await register(request, "Storefront Seller Two");
  const sellerTwoCreate = await request.post(`${api}/seller-profile`, {
    headers: headers(sellerTwoToken),
    data: {
      displayName: "Storefront Two",
      bio: "Second seller bio",
    },
  });
  expect(sellerTwoCreate.status()).toBe(201);
  const sellerTwo = (await sellerTwoCreate.json()).data;

  const invalidUpdate = await request.patch(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
    data: { displayName: "x" },
  });
  expect(invalidUpdate.status()).toBe(400);

  const update = await request.patch(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
    data: {
      displayName: "Storefront One Updated",
      bio: "Updated public storefront bio",
    },
  });
  expect(update.status()).toBe(200);
  expect((await update.json()).data).toEqual(
    expect.objectContaining({
      id: sellerOne.id,
      displayName: "Storefront One Updated",
      bio: "Updated public storefront bio",
    }),
  );

  const ownProfile = await request.get(`${api}/seller-profile`, {
    headers: headers(sellerOneToken),
  });
  expect(ownProfile.status()).toBe(200);
  expect((await ownProfile.json()).data).toEqual(
    expect.objectContaining({
      id: sellerOne.id,
      displayName: "Storefront One Updated",
      bio: "Updated public storefront bio",
    }),
  );

  const publicStore = await request.get(`${api}/sellers/${sellerOne.id}`);
  expect(publicStore.status()).toBe(200);
  expect((await publicStore.json()).data).toEqual(
    expect.objectContaining({
      id: sellerOne.id,
      displayName: "Storefront One Updated",
      bio: "Updated public storefront bio",
    }),
  );

  const sellerTwoAfter = await request.get(`${api}/seller-profile`, {
    headers: headers(sellerTwoToken),
  });
  expect(sellerTwoAfter.status()).toBe(200);
  expect((await sellerTwoAfter.json()).data).toEqual(
    expect.objectContaining({
      id: sellerTwo.id,
      displayName: "Storefront Two",
      bio: "Second seller bio",
    }),
  );
});

test("seller can edit storefront details from the workspace and see them publicly", async ({
  page,
}) => {
  const email = `storefront-ui-${randomUUID()}@eazicart.invalid`;
  const password = `storefront-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Storefront UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await expect(
    page.getByRole("heading", { name: "Start selling on EaziCart" }),
  ).toBeVisible();
  await page.getByLabel("Store name").fill("Storefront UI Store");
  await page.getByLabel(/Store bio/).fill("Original UI store bio");
  await page.getByRole("button", { name: "Create seller profile" }).click();

  await expect(
    page.getByRole("heading", { name: "Storefront UI Store", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage store" }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/store");
  await expect(
    page.getByRole("heading", { name: "Manage your storefront" }),
  ).toBeVisible();
  await expect(page.getByLabel("Store name")).toHaveValue(
    "Storefront UI Store",
  );
  await expect(page.getByLabel(/Store bio/)).toHaveValue(
    "Original UI store bio",
  );

  await page.getByLabel("Store name").fill("Storefront UI Updated");
  await page.getByLabel(/Store bio/).fill("Updated UI public bio");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText(
      "Storefront updated. Your public seller page now uses these details.",
    ),
  ).toBeVisible();

  await page.getByRole("link", { name: "View public store" }).click();
  await expect(page).toHaveURL(/http:\/\/localhost:3000\/seller\/.+/);
  await expect(
    page
      .getByRole("heading", { name: "Storefront UI Updated", exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Updated UI public bio").first()).toBeVisible();
});
