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

test("subscription pricing, navigation and payment availability follow the current plans", async ({
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

  await page.goto("/seller/subscription?plan=PRO&billing=MONTHLY");
  await expect(
    page.getByRole("heading", {
      name: "More for your store. One simple plan.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /₦49,900 yearly/ }).click();
  await expect(page).toHaveURL(/billing=YEARLY/);
  await expect(
    page.getByRole("button", { name: /₦49,900 yearly/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("button", { name: /₦2,999 monthly/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await page.getByRole("link", { name: "Upgrade to Pro", exact: true }).click();
  await expect(page).toHaveURL(/review\?plan=PRO&billing=YEARLY/);
  await expect(page.getByLabel("Subscription summary")).toContainText(
    "₦49,900",
  );
  await expect(
    page.getByText(
      "₦49,900 billed yearly. The monthly launch offer does not apply.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /Payment method/ }).click();
  await page
    .getByRole("button", { name: /Bank transfer Manual renewal/ })
    .click();
  await expect(page).toHaveURL(/method=TRANSFER/);
  await expect(
    page.getByRole("button", { name: /Payment method/ }),
  ).toContainText("Bank transfer");
  await expect(
    page.getByRole("button", { name: "Continue to secure payment" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Back to plans", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /₦49,900 yearly/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Upgrade to Pro", exact: true }).click();
  await expect(page).toHaveURL(/method=TRANSFER/);
  await page.getByRole("link", { name: "Back to plans", exact: true }).click();
  await page.getByRole("tab", { name: "Basic", exact: true }).click();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start selling for free" }),
  ).toHaveAttribute("href", "/seller/dashboard");
  await page.getByRole("tab", { name: "Business", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Business coming soon" }),
  ).toBeDisabled();
});
