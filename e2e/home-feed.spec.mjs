import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Home feed follow and cart actions persist through the real API", async ({
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
  await expect(page).toHaveURL("http://localhost:3000/");

  const seller = page.locator(".figma-home-seller").filter({
    hasText: "Lagos Studio",
  });
  await expect(seller).toBeVisible();
  await seller.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    seller.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();

  const product = seller.locator(".figma-home-product").filter({
    hasText: "Woven everyday tote",
  });
  await expect(product).toBeVisible();
  await product.getByRole("button", { name: "Add to Cart" }).click();

  await page.goto("/following");
  await expect(
    page.getByRole("heading", { name: "Saved Sellers", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Saved sellers" })
      .getByText(/^\d+ followers?$/),
  ).toBeVisible();
  await expect(page.getByLabel("Search saved sellers")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unfollow Lagos Studio" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/cart");
  await expect(
    page.getByText("Woven everyday tote", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quantity span")).toHaveText("1");
  await expect(page.locator(".summary .total")).toContainText("18,500");
});
