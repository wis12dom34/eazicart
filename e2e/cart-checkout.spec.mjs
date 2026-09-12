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
  await expect(page.locator(".summary .total")).toContainText("18,500");
  await expect(page.getByText("Not added", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Home" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL("http://localhost:3000/checkout");
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 Checkout Street", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("No payment required yet")).toBeVisible();
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Wallet balance", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Service fee", { exact: true })).toHaveCount(0);
  await expect(page.locator(".summary .total")).toContainText("18,500");
  await expect(page.getByRole("button", { name: "Place Order" })).toBeEnabled();
});
