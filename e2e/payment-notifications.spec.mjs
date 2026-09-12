import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";
const productId = "demo-product-woven-tote";

test("payment methods stay honest and notifications use live account data", async ({
  page,
  request,
}) => {
  const email = `notifications-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Notification Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/payment-methods");
  await expect(
    page.getByRole("heading", { name: "Payment Methods", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add payment method/ }),
  ).toBeDisabled();
  await expect(
    page.getByText("Payment methods aren't available yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No payment provider is connected in this MVP.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Balance ₦86,400/)).toHaveCount(0);
  await expect(page.getByText(/Visa •••• 2048/)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");

  const tokens = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("eazicart.auth.tokens")),
  );
  const headers = { Authorization: `Bearer ${tokens.accessToken}` };
  const address = await request.post(`${api}/addresses`, {
    headers,
    data: {
      label: "Home",
      line1: "1 Notification Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  const added = await request.post(`${api}/cart/items`, {
    headers,
    data: { productId, quantity: 1 },
  });
  expect(added.status()).toBe(201);
  const order = await request.post(`${api}/orders`, {
    headers,
    data: { addressId: (await address.json()).data.id },
  });
  expect(order.status()).toBe(201);

  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Order received", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your order was created. No payment has been taken."),
  ).toBeVisible();

  const filters = page.getByLabel("Notification filters");
  await filters.getByRole("button", { name: "Orders" }).click();
  await expect(page.getByText("Order received", { exact: true })).toBeVisible();
  await filters.getByRole("button", { name: "Social" }).click();
  await expect(
    page.getByRole("heading", { name: "No social notifications" }),
  ).toBeVisible();
  await filters.getByRole("button", { name: "All" }).click();

  await page.getByText("Mark all as read", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Order received, read" }),
  ).toBeVisible();
  await expect(page.getByText("Mark all as read", { exact: true })).toHaveCount(
    0,
  );
});
