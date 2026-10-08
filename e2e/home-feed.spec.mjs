import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const web = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3000";
import { expectCustomerNavigation } from "./customer-navigation.mjs";

test("Home saves and supported seller/cart actions persist through the real API", async ({
  page,
}) => {
  const email = `home-${randomUUID()}@eazicart.invalid`;
  const password = randomUUID();
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Home Feed Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${web}/`);

  const product = page
    .locator(".figma-home-product")
    .filter({ hasText: "Woven everyday tote" });
  await expect(product).toBeVisible();
  await product
    .getByRole("button", { name: "Save Woven everyday tote", exact: true })
    .click();
  await expect(
    product.getByRole("button", {
      name: "Unsave Woven everyday tote",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    product.getByRole("button", {
      name: "Unsave Woven everyday tote",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await product
    .getByRole("link", { name: "View Woven everyday tote", exact: true })
    .click();
  await expect(page).toHaveURL(/\/product\/demo-product-woven-tote$/);
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to cart");
  await page.getByRole("link", { name: /View .* seller profile/ }).click();
  await expect(page).toHaveURL(/\/seller\/demo-seller-lagos-studio$/);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();

  await page.goto("/following");
  await expect(
    page.getByRole("heading", { name: "Following", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Following sections" })
      .getByText("Following", { exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "Following sections" })
      .getByText("Recommended", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Followed sellers").getByText(/^\d+ followers?$/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unfollow Lagos Studio", exact: true }),
  ).toBeVisible();
  await expectCustomerNavigation(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfollow Lagos Studio", exact: true }),
  ).toBeVisible();

  await page.goto("/cart");
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quantity span")).toHaveText("1");
  await expect(
    page.getByText("Total", { exact: true }).locator(".."),
  ).toContainText("18,500");
  await expectCustomerNavigation(page, "Cart");
});
