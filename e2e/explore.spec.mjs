import { test, expect } from "@playwright/test";
import { expectCustomerNavigation } from "./customer-navigation.mjs";

const api = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

async function catalog(request) {
  const response = await request.get(`${api}/products?limit=100`);
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

test("Explore exposes only real discovery destinations and catalog data", async ({
  page,
  request,
}) => {
  const products = await catalog(request);

  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Explore", exact: true }),
  ).toBeVisible();

  const search = page.getByRole("textbox", {
    name: "Search products and sellers",
  });
  await expect(search).toBeVisible();

  const sections = page.getByRole("navigation", { name: "Explore sections" });
  await expect(sections.getByRole("link", { name: "For You" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    sections.getByRole("link", { name: "Categories" }),
  ).toHaveAttribute("href", "/explore?section=categories");
  await expect(sections.getByRole("link", { name: "Sellers" })).toHaveAttribute(
    "href",
    "/explore?section=sellers",
  );
  await expect(sections.getByText("Trending", { exact: true })).toHaveCount(0);
  await expect(sections.getByText("Brands", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Map" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.locator(".figma-explore-product")).toHaveCount(
    products.length,
  );
  for (const product of products) {
    await expect(
      page.getByRole("link", { name: `View ${product.name}`, exact: true }),
    ).toHaveAttribute("href", `/product/${product.id}`);
  }
  await expectCustomerNavigation(page, "Explore");

  await sections.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/explore\?section=categories$/);
  await expect(
    page.getByRole("heading", { name: "Categories", exact: true }),
  ).toBeVisible();
  const realCategory = products[0]?.category;
  if (realCategory) {
    await expect(
      page.getByRole("link", { name: realCategory.name, exact: true }),
    ).toHaveAttribute("href", `/category/${realCategory.slug}`);
  }

  await page
    .getByRole("link", { name: "Sellers", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/explore\?section=sellers$/);
  await expect(
    page.getByRole("heading", { name: "Sellers", exact: true }),
  ).toBeVisible();

  await page.goto("/explore");
  await search.fill("Woven");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?search=Woven/);
  await expect(
    page.getByRole("heading", { name: "Search", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Search filters" }).getByText("Reels"),
  ).toHaveCount(0);
});

test("Explore recovers from a failed live product request", async ({
  page,
}) => {
  let failedOnce = false;
  await page.route(/\/products(?:\?|$)/, async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
});
