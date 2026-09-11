import { test, expect } from "@playwright/test";

test("Explore matches the Figma structure and filters the live catalog", async ({
  page,
}, testInfo) => {
  await page.goto("/explore");

  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search products, brands and sellers" }),
  ).toBeVisible();

  const browse = page.getByRole("navigation", { name: "Explore browse" });
  await expect(browse.getByRole("link", { name: "Categories" })).toBeVisible();
  await expect(browse.getByRole("link", { name: "Brands" })).toBeVisible();
  await expect(browse.getByRole("link", { name: "Sellers" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Trending Now" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Popular Products" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top Sellers" })).toBeVisible();
  await expect(page.getByText("Lagos Studio", { exact: true })).toBeVisible();
  await expect(page.getByText("Home Edit", { exact: true })).toBeVisible();

  const productCards = page.locator(".figma-explore-product");
  await expect(productCards).toHaveCount(2);
  const firstCard = await productCards.first().boundingBox();
  expect(Math.round(firstCard.width)).toBe(184);
  expect(Math.round(firstCard.height)).toBe(220);

  await page.screenshot({ path: testInfo.outputPath("explore.png") });

  await page
    .getByRole("link", { name: "Fashion", exact: true })
    .click();
  await expect(page).toHaveURL(/category=fashion/);
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Relaxed linen shirt" }),
  ).toBeVisible();
});
