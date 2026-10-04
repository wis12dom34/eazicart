import { expectCustomerNavigation } from "./customer-navigation.mjs";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";
const productId = "demo-product-woven-tote";

test("cart and checkout match the customer flow without fake payment data", async ({
  page,
  request,
}) => {
  const email = `cart-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Cart Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  const tokens = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("eazicart.auth.tokens")),
  );
  const headers = { Authorization: `Bearer ${tokens.accessToken}` };

  const added = await request.post(`${api}/cart/items`, {
    headers,
    data: { productId, quantity: 1 },
  });
  expect(added.status()).toBe(201);

  const address = await request.post(`${api}/addresses`, {
    headers,
    data: {
      label: "Home",
      line1: "1 Checkout Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);

  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Cart", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 item", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();
  await expect(
    page.getByText("Total", { exact: true }).locator(".."),
  ).toContainText("18,500");
  await expect(page.getByText("Not added", { exact: true })).toBeVisible();
  await expectCustomerNavigation(page, "Cart");

  await page.getByRole("link", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL("http://localhost:3000/checkout");
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 Checkout Street", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Paystack", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Wallet balance", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Service fee", { exact: true }).locator(".."),
  ).toContainText("Not added");
  await expect(
    page.getByText("Total", { exact: true }).locator(".."),
  ).toContainText("18,500");
  await expect(
    page.getByRole("button", { name: /Place order/i }),
  ).toBeEnabled();
  await expect(page.getByText("Secure payment", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Change" }).click();
  await expect(page).toHaveURL(/\/address-book\?checkout=1/);
  await expect(
    page.getByRole("heading", { name: "Delivery address", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit Home" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit delivery address", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Street address", { exact: true }).fill(
    "2 Checkout Street",
  );
  await page.getByRole("button", { name: "Save changes" }).click();

  await page.getByRole("button", { name: "+ Add new address" }).click();
  await expect(
    page.getByRole("heading", { name: "Add delivery address", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Phone number").fill("+2348000000000");
  await page.getByLabel("Street address", { exact: true }).fill(
    "10 Second Checkout Road",
  );
  await page.getByLabel("State", { exact: true }).fill("Lagos");
  await page.getByLabel("City / Area", { exact: true }).fill("Ikeja");
  await page.getByLabel("Postal code").fill("100002");
  await page.getByLabel("Country", { exact: true }).fill("Nigeria");
  await page.getByLabel("Label", { exact: true }).fill("Work");
  await page.getByRole("button", { name: "Save address" }).click();

  await expect(
    page.getByRole("heading", { name: "Delivery address", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10 Second Checkout Road")).toBeVisible();

  const workAddress = page
    .getByRole("radio")
    .filter({ hasText: "10 Second Checkout Road" });
  await workAddress.click();
  await page.getByRole("link", { name: "Use selected address" }).click();
  await expect(page).toHaveURL(/\/checkout\?addressId=/);
  await expect(page.getByText("10 Second Checkout Road")).toBeVisible();
});
