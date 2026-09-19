import { test, expect } from "@playwright/test";

const api = "http://localhost:3001";

test("Explore matches Figma and opens live search and category discovery", async ({
  page,
  request,
}, testInfo) => {
  const sellersResponse = await request.get(`${api}/sellers`);
  expect(sellersResponse.status()).toBe(200);
  const expectedTopSellers = (await sellersResponse.json()).data.slice(0, 3);
  const fashionResponse = await request.get(
    `${api}/products?category=fashion&limit=20`,
  );
  expect(fashionResponse.status()).toBe(200);
  const fashionData = await fashionResponse.json();
  const expectedFashionTotal = fashionData.pagination.total;
  const expectedFashionSeller = fashionData.data[0]?.seller.displayName;
  expect(expectedFashionSeller).toBeTruthy();

  await page.goto("/explore");

  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search products, brands and sellers",
  });
  await expect(search).toBeVisible();

  const browse = page.getByRole("navigation", { name: "Explore browse" });
  await expect(browse.getByRole("link", { name: "Categories" })).toBeVisible();
  await expect(browse.getByRole("button", { name: "Brands" })).toBeDisabled();
  await expect(browse.getByRole("link", { name: "Brands" })).toHaveCount(0);
  await expect(browse.getByRole("link", { name: "Sellers" })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Trending Now" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Popular Products" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Top Sellers" }),
  ).toBeVisible();
  for (const seller of expectedTopSellers) {
    await expect(
      page.getByText(seller.displayName, { exact: true }),
    ).toBeVisible();
  }

  const productCards = page.locator(".figma-explore-product");
  await expect(productCards).toHaveCount(2);
  const firstCard = await productCards.first().boundingBox();
  expect(Math.round(firstCard.width)).toBe(184);
  expect(Math.round(firstCard.height)).toBe(220);

  await page.screenshot({ path: testInfo.outputPath("explore.png") });

  await search.fill("Woven");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?search=Woven/);
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  await expect(page.getByText("1 results", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Customer navigation" })
      .getByRole("link", { name: "Explore" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("navigation", { name: "Search filters" })
      .getByText("Reels", { exact: true }),
  ).toHaveAttribute("aria-disabled", "true");

  await page.goto("/explore");
  await page.getByRole("link", { name: "Fashion", exact: true }).click();
  await expect(page).toHaveURL(/\/category\/fashion$/);
  await expect(
    page.getByRole("heading", { name: "Fashion", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${expectedFashionTotal} products`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Woven everyday tote" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Relaxed linen shirt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sellers in Fashion" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(expectedFashionSeller) }),
  ).toBeVisible();
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
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.locator(".figma-explore-product")).toHaveCount(2);
});
