import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";
const productId = "demo-product-woven-tote";

test("orders and tracking use real PostgreSQL order state without shipment fixtures", async ({
  page,
  request,
}) => {
  const email = `orders-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Orders Customer");
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
      line1: "12 Orders Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  const addressId = (await address.json()).data.id;

  const created = await request.post(`${api}/orders`, {
    headers,
    data: { addressId },
  });
  expect(created.status()).toBe(201);
  const order = (await created.json()).data;
  expect(order.status).toBe("PENDING");

  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "My Orders", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(`a[href="/orders/${order.id}"]`)
      .getByText("Processing", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Processing", exact: true }).click();
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Orders" }),
  ).toHaveAttribute("aria-current", "page");

  await page.locator(`a[href="/orders/${order.id}"]`).click();
  await expect(page).toHaveURL(`http://localhost:3000/orders/${order.id}`);
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  await expect(
    page.getByText("12 Orders Street", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".summary .total")).toContainText("18,500");
  await expect(
    page.getByText("Payment summary", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Subtotal", { exact: true })).toBeVisible();
  await expect(page.getByText("Service fee", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Track order" }).click();
  await expect(page).toHaveURL(`http://localhost:3000/tracking/${order.id}`);
  await expect(
    page.getByRole("heading", { name: "Track Order", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Order placed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your order was created and is waiting for confirmation.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Detailed delivery tracking isn’t available yet.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Swift Dispatch", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Estimated delivery/i)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Orders" }),
  ).toHaveAttribute("aria-current", "page");
});
