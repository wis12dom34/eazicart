import { test, expect } from "@playwright/test";
import { expectCustomerNavigation } from "./customer-navigation.mjs";

const api = "http://localhost:3001";

async function canonicalProducts(request) {
  const response = await request.get(`${api}/products?limit=100`);
  expect(response.status()).toBe(200);
  return (await response.json()).data.filter(
    (product) =>
      (product.name === "AirPods Pro" &&
        product.seller.displayName === "Jumia Nigeria") ||
      (product.name === "Nike Air Max 90" &&
        product.seller.displayName === "Nike Official"),
  );
}

test("Explore preserves supported search and truthful unavailable discovery", async ({
  page,
  request,
}, testInfo) => {
  const available = await canonicalProducts(request);
  const fashionResponse = await request.get(
    `${api}/products?category=fashion&limit=20`,
  );
  expect(fashionResponse.status()).toBe(200);
  const fashion = await fashionResponse.json();

  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Explore", exact: true }),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search products, stores or brands",
  });
  await expect(search).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Explore sections" });
  await expect(sections.getByText("For You", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const label of ["Trending", "Categories", "Brands", "Sellers"]) {
    await expect(sections.getByText(label, { exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(
      sections.getByRole("link", { name: label, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Map", exact: true }),
  ).toBeDisabled();
  for (const name of ["Trending Now", "Popular Products", "Top Sellers"]) {
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.locator(".figma-explore-product")).toHaveCount(
    available.length,
  );
  for (const product of available) {
    await expect(
      page.getByRole("link", { name: `View ${product.name}`, exact: true }),
    ).toHaveAttribute("href", `/product/${product.id}`);
  }
  if (!available.length) {
    await expect(
      page.getByText("No products match your search.", { exact: true }),
    ).toBeVisible();
  }
  await expectCustomerNavigation(page, "Explore");
  await page.screenshot({ path: testInfo.outputPath("explore.png") });

  await search.fill("Woven");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?search=Woven/);
  await expect(
    page.getByRole("heading", { name: "Search", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 results", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote", exact: true }),
  ).toBeVisible();
  await expectCustomerNavigation(page, "Explore");
  await expect(
    page
      .getByRole("navigation", { name: "Search filters" })
      .getByText("Reels", { exact: true }),
  ).toHaveAttribute("aria-disabled", "true");

  // Categories remain real routes; the unavailable Explore tab must not pretend
  // that it opens a category picker which the application does not implement.
  await page.goto("/category/fashion");
  await expect(
    page.getByRole("heading", { name: "Fashion", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${fashion.pagination.total} products`, { exact: true }),
  ).toBeVisible();
  for (const product of fashion.data) {
    await expect(
      page.getByRole("link", { name: `View ${product.name}`, exact: true }),
    ).toHaveAttribute("href", `/product/${product.id}`);
  }
  await expect(
    page.getByRole("heading", { name: "Sellers in Fashion", exact: true }),
  ).toBeVisible();
  await expectCustomerNavigation(page, "Explore");
});

test("Explore recovers from a failed live product request", async ({
  page,
  request,
}) => {
  const available = await canonicalProducts(request);
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
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".figma-explore-product")).toHaveCount(
    available.length,
  );
  if (!available.length) {
    await expect(
      page.getByText("No products match your search.", { exact: true }),
    ).toBeVisible();
  }
});
