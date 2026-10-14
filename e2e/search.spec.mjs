import { expect, test } from "@playwright/test";

const seller = {
  id: "search-seller",
  userId: "search-seller-user",
  displayName: "Travel Store",
  bio: "Everyday travel essentials",
};
const product = {
  id: "search-product",
  name: "Travel essentials",
  price: "12500",
  stock: 5,
  images: [],
  category: { id: "search-category", name: "Travel", slug: "travel" },
  seller,
};

async function searchFixtures(page, selectedFilter, failSelected = false) {
  const requests = { products: [], sellers: [] };
  await page.route(/\/(products|sellers)(?:\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    const kind = url.pathname.endsWith("/products") ? "products" : "sellers";
    requests[kind].push(url.searchParams.get("search"));
    const unavailable =
      kind !== selectedFilter || (failSelected && requests[kind].length === 1);
    await route.fulfill({
      status: unavailable ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        unavailable
          ? {
              error: {
                code: "UNAVAILABLE",
                message: "Temporarily unavailable",
              },
            }
          : {
              data: kind === "products" ? [product] : [seller],
              pagination: { total: 1 },
            },
      ),
    });
  });
  return requests;
}

for (const filter of ["products", "sellers"]) {
  test(`${filter} search stays usable when the other category fails and retains the filter`, async ({
    page,
  }) => {
    const requests = await searchFixtures(page, filter);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`/search?filter=${filter}&search=travel`);
    await expect(page.getByText("1 result", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Search is unavailable", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name:
          filter === "products"
            ? product.name
            : `${seller.displayName} ${seller.bio} View`,
        exact: true,
      }),
    ).toBeVisible();
    const input = page.getByRole("searchbox", {
      name: "Search products and sellers",
    });
    await expect(input).toHaveAttribute("enterkeyhint", "search");
    expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(
      await input.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe("16px");
    await input.fill("essentials");
    await input.press("Enter");
    await expect(page).toHaveURL(/search=.*essentials/);
    expect(new URL(page.url()).searchParams.get("filter")).toBe(filter);
    await expect(
      page
        .getByRole("navigation", { name: "Search filters" })
        .getByRole("link", {
          name: filter === "products" ? "Products" : "Sellers",
          exact: true,
        }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("1 result", { exact: true })).toBeVisible();
    if (filter === "products")
      expect(requests.products).toContain("essentials");
    await expect(
      page.getByRole("link", { name: "Explore", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
}

test("filtered search retry restores selected results without retrying the hidden category", async ({
  page,
}) => {
  const requests = await searchFixtures(page, "products", true);
  await page.goto("/search?filter=products&search=travel");
  await expect(
    page.getByText("Search is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Search unavailable", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => requests.sellers.length).toBe(1);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("link", { name: product.name, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 result", { exact: true })).toBeVisible();
  expect(requests.products).toHaveLength(2);
  expect(requests.sellers).toHaveLength(1);
});
