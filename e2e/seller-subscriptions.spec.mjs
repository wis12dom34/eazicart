import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `subscription-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).tokens.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

test("seller subscription catalog is real, private and unpriced until configured", async ({
  request,
}) => {
  const unauthenticatedPlans = await request.get(
    `${api}/seller/subscription/plans`,
  );
  expect(unauthenticatedPlans.status()).toBe(401);

  const token = await register(request, "Subscription Seller");
  const plans = await request.get(`${api}/seller/subscription/plans`, {
    headers: headers(token),
  });
  expect(plans.status()).toBe(200);
  expect((await plans.json()).data).toEqual([
    expect.objectContaining({
      code: "BASIC",
      name: "Basic",
      monthlyPrice: null,
      productLimit: null,
      campaignLimit: null,
      advancedAnalytics: null,
      published: false,
      purchasable: false,
    }),
    expect.objectContaining({
      code: "PRO",
      name: "Pro",
      monthlyPrice: null,
      productLimit: null,
      campaignLimit: null,
      advancedAnalytics: null,
      published: false,
      purchasable: false,
    }),
    expect.objectContaining({
      code: "BUSINESS",
      name: "Business",
      monthlyPrice: null,
      productLimit: null,
      campaignLimit: null,
      advancedAnalytics: null,
      published: false,
      purchasable: false,
    }),
  ]);

  const withoutSeller = await request.get(`${api}/seller/subscription`, {
    headers: headers(token),
  });
  expect(withoutSeller.status()).toBe(403);
  expect((await withoutSeller.json()).error.code).toBe("SELLER_REQUIRED");

  const profile = await request.post(`${api}/seller-profile`, {
    headers: headers(token),
    data: { displayName: "Subscription Seller Store" },
  });
  expect(profile.status()).toBe(201);

  const current = await request.get(`${api}/seller/subscription`, {
    headers: headers(token),
  });
  expect(current.status()).toBe(200);
  expect((await current.json()).data).toEqual({ subscription: null });
});

test("seller subscription screen exposes no fake pricing or purchase action", async ({
  page,
}) => {
  const email = `subscription-ui-${randomUUID()}@eazicart.invalid`;
  const password = `subscription-ui-${randomUUID()}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Subscription UI Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/seller/dashboard");
  await page.getByLabel("Store name").fill("Subscription UI Store");
  await page.getByRole("button", { name: "Create seller profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Subscription UI Store", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Subscription" }).click();
  await expect(page).toHaveURL("http://localhost:3000/seller/subscription");

  await expect(
    page.getByRole("heading", { name: "Plans built for your store" }),
  ).toBeVisible();
  await expect(page.getByText("No active subscription")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business" })).toBeVisible();
  await expect(page.getByText("Pricing not configured")).toHaveCount(3);
  await expect(page.getByText("Not configured", { exact: true })).toHaveCount(
    9,
  );
  await expect(
    page.getByRole("button", { name: "Not available yet" }),
  ).toHaveCount(3);
  for (const button of await page
    .getByRole("button", { name: "Not available yet" })
    .all()) {
    await expect(button).toBeDisabled();
  }
});
