import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://localhost:3001";
const productId = "demo-product-woven-tote";
const sellerId = "demo-seller-lagos-studio";

test("customer journey persists in PostgreSQL without payment", async ({
  page,
  request,
}) => {
  const email = `customer-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Demo Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText("Woven everyday tote").first()).toBeVisible();

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Demo Customer", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  const profileCounts = page.getByRole("region", {
    name: "Profile activity counts",
  });
  await expect(
    profileCounts.getByRole("link", { name: "0 Orders" }),
  ).toBeVisible();
  await expect(
    profileCounts.getByRole("link", { name: "0 Saved" }),
  ).toBeVisible();
  await expect(
    profileCounts.getByRole("link", { name: "0 Following" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL("http://localhost:3000/settings");
  await expect(
    page.getByRole("heading", { name: "Account Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/explore");
  await expect(
    page.getByRole("link", { name: "Fashion", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Fashion", exact: true }).click();
  await expect(page.getByText("Woven everyday tote").first()).toBeVisible();
  await page.goto(`/product/${productId}`);
  await expect(
    page.getByRole("heading", { name: "Woven everyday tote" }),
  ).toBeVisible();
  await expect(page.locator(".detail-image img")).toBeVisible();
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Products you want to come back to"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Saved sections" })
      .getByText("Products", { exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "Saved sections" })
      .getByRole("link", { name: "Sellers" }),
  ).toHaveAttribute("href", "/following");
  await expect(
    page
      .getByRole("navigation", { name: "Saved sections" })
      .getByRole("button", { name: "Collections" }),
  ).toBeDisabled();
  await expect(page.getByText("Woven everyday tote").first()).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Remove Woven everyday tote from saved products",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto(`/product/${productId}`);
  await page.getByRole("link", { name: /View .* seller profile/ }).click();
  await expect(page).toHaveURL(`http://localhost:3000/seller/${sellerId}`);
  await expect(
    page.getByRole("heading", { name: "Lagos Studio", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Products" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Woven everyday tote").first()).toBeVisible();
  await page.getByRole("tab", { name: "About" }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "About" })
      .getByText("Demo fashion and everyday essentials."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Reviews" }).click();
  await expect(
    page.getByText("Seller reviews are not available yet."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Products" }).click();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.goto("/following");
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();

  await page.goto(`/product/${productId}`);
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to cart");
  await page.goto("/cart");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.locator(".quantity span")).toHaveText("2");
  await expect(page.locator(".summary .total")).toContainText("37,000");

  await page.goto("/address-book");
  await page.getByRole("button", { name: "Add new" }).click();
  await page.getByLabel("Label", { exact: true }).fill("Home");
  await page.getByLabel("Address", { exact: true }).fill("1 Demo Street");
  await page.getByLabel("City", { exact: true }).fill("Lagos");
  await page.getByLabel("State / region").fill("Lagos");
  await page.getByLabel("Postal code").fill("100001");
  await page.getByLabel("Country", { exact: true }).fill("Nigeria");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.locator(".address-card")).toContainText("1 Demo Street");

  await page.goto("/checkout");
  await expect(page.getByText("No payment required yet")).toBeVisible();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  const orderUrl = page.url();
  await expect(page.getByText("Processing", { exact: true })).toBeVisible();
  await expect(page.locator(".summary .total")).toContainText("37,000");
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  await page.goto("/orders");
  await page.locator(`a[href="${new URL(orderUrl).pathname}"]`).click();
  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByText("Woven everyday tote")).toBeVisible();

  await page.goto("/profile");
  const populatedCounts = page.getByRole("region", {
    name: "Profile activity counts",
  });
  await expect(
    populatedCounts.getByRole("link", { name: "1 Orders" }),
  ).toBeVisible();
  await expect(
    populatedCounts.getByRole("link", { name: "1 Saved" }),
  ).toBeVisible();
  await expect(
    populatedCounts.getByRole("link", { name: "1 Following" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Reviews Your ratings and feedback/ })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/reviews");
  await expect(
    page.getByRole("heading", { name: "Reviews are not available yet" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/saved");
  await page
    .getByRole("button", {
      name: "Remove Woven everyday tote from saved products",
    })
    .click();
  await expect(page.getByText("You have no saved products.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("You have no saved products.")).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByText("Order received", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your order was created. No payment has been taken."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Read all" }).click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page.goto("/edit-profile");
  await page.getByLabel("Full name").fill("Updated Customer");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated Customer" }),
  ).toBeVisible();

  // Force an expired access token and verify the actual refresh endpoint.
  await page.evaluate(() => {
    const key = "eazicart.auth.tokens";
    const tokens = JSON.parse(localStorage.getItem(key));
    tokens.accessToken = "expired-token";
    localStorage.setItem(key, JSON.stringify(tokens));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Updated Customer" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Account settings" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.goto(orderUrl);
  await expect(page.getByText("Woven everyday tote")).toBeVisible();

  // A second customer cannot read this customer's order.
  const outsider = await request.post(`${api}/auth/register`, {
    data: { name: "Other Customer", email: `other-${email}`, password },
  });
  expect(outsider.status()).toBe(201);
  const otherTokens = (await outsider.json()).tokens;
  const forbidden = await request.get(`${api}${new URL(orderUrl).pathname}`, {
    headers: { Authorization: `Bearer ${otherTokens.accessToken}` },
  });
  expect(forbidden.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("API trusts database prices and enforces CORS and ownership", async ({
  request,
}) => {
  const result = await request.post(`${api}/auth/register`, {
    data: {
      name: "Price Test",
      email: `price-${randomUUID()}@eazicart.invalid`,
      password: randomUUID(),
    },
  });
  expect(result.status()).toBe(201);
  const headers = {
    Authorization: `Bearer ${(await result.json()).tokens.accessToken}`,
  };
  const address = await request.post(`${api}/addresses`, {
    headers,
    data: {
      line1: "1 Demo Street",
      city: "Lagos",
      region: "Lagos",
      postalCode: "100001",
      country: "Nigeria",
    },
  });
  expect(address.status()).toBe(201);
  const added = await request.post(`${api}/cart/items`, {
    headers,
    data: { productId, quantity: 1, unitPrice: "0.01" },
  });
  expect(added.status()).toBe(201);
  const created = await request.post(`${api}/orders`, {
    headers,
    data: { addressId: (await address.json()).data.id, total: "0.01" },
  });
  expect(created.status()).toBe(201);
  expect(Number((await created.json()).data.total)).toBe(18500);
  const empty = await request.post(`${api}/orders`, {
    headers,
    data: { addressId: (await address.json()).data.id },
  });
  expect(empty.status()).toBe(400);
  for (const origin of ["http://localhost:3000", "https://untrusted.invalid"]) {
    const preflight = await request.fetch(`${api}/cart`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "PATCH" },
    });
    expect(preflight.headers()["access-control-allow-origin"]).toBe(
      origin === "http://localhost:3000" ? origin : undefined,
    );
  }
});
