import { expect, test } from "@playwright/test";

const productId = "product-without-reel";

test("product-scoped feed keeps a valid empty Reel response empty", async ({
  page,
}) => {
  let productRequestCount = 0;

  await page.route(/\/reels\/feed(?:\?|$)/, async (route) => {
    expect(route.request().url()).toContain(`productId=${productId}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      }),
    });
  });

  await page.route(
    new RegExp(`/products/${productId}(?:\\?|$)`),
    async (route) => {
      productRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: productId,
            name: "Plain product",
            description: null,
            price: "12000",
            stock: 3,
            images: [],
            category: { id: "category-1", name: "General", slug: "general" },
            seller: {
              id: "seller-1",
              userId: "seller-user-1",
              displayName: "Seller One",
            },
          },
        }),
      });
    },
  );

  await page.goto(`/reels?productId=${productId}`);

  await expect(
    page.getByText("No reels have been published yet.", { exact: true }),
  ).toBeVisible();
  expect(productRequestCount).toBe(0);
});
