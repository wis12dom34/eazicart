import { expect, test } from "@playwright/test";

const imageUrl = "https://test.public.blob.vercel-storage.com/product.png";
async function imageFixtures(page, sourceWorks) {
  const product = {
    id: "photo-product",
    name: "Photo product",
    price: "15000",
    stock: 5,
    images: [{ url: imageUrl }],
    category: { id: "cat", name: "Fashion", slug: "fashion" },
    seller: {
      id: "photo-store",
      userId: "photo-seller",
      displayName: "Photo store",
    },
  };
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/users/me" || path === "/auth/refresh")
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Sign in" } }),
      });
    const body =
      path === "/products"
        ? {
            data: [product],
            pagination: { page: 1, pages: 1, total: 1, limit: 6 },
          }
        : path === "/reels/feed"
          ? { data: [], pagination: { hasMore: false, nextCursor: null } }
          : { data: [] };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/plain",
      body: "Optimizer unavailable",
    }),
  );
  await page.route(imageUrl, (route) =>
    sourceWorks
      ? route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#ff6a00"/></svg>',
        })
      : route.fulfill({ status: 403, body: "Your store is blocked" }),
  );
}

test("blocked product photos render a working local fallback without overflow", async ({
  page,
}) => {
  await imageFixtures(page, false);
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const photo = page
      .locator(
        ".social-home[data-figma-node]:visible img[data-photo-unavailable]",
      )
      .first();
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", "/photo-unavailable.svg");
    await expect
      .poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("optimizer failure retries and displays the real original photo", async ({
  page,
}) => {
  await imageFixtures(page, true);
  await page.goto("/");
  const photo = page
    .locator(
      '.social-home[data-figma-node]:visible img[src="' + imageUrl + '"]',
    )
    .first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(photo).not.toHaveAttribute("data-photo-unavailable", "true");
});
