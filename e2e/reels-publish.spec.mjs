import { test, expect } from "@playwright/test";
const video = Buffer.from([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
]);
async function seller(page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "eazicart.auth.tokens",
      JSON.stringify({
        accessToken: "publish-test",
        refreshToken: "publish-refresh",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    ),
  );
  await page.route(/\/users\/me(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        id: "seller-user",
        name: "Publisher",
        email: "publish@example.com",
      },
    }),
  );
  await page.route(/\/seller-profile(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          id: "seller-1",
          userId: "seller-user",
          displayName: "Seller One",
        },
      },
    }),
  );
  await page.route(/\/seller\/products(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: [
          { id: "product-1", name: "Handmade bag", active: true },
          { id: "inactive", name: "Hidden product", active: false },
        ],
      },
    }),
  );
}
test("seller publishes a phone video and can open its Reel", async ({
  page,
}) => {
  await seller(page);
  let uploads = 0,
    publishes = 0;
  await page.route(/\/seller\/reels\/media$/, async (route) => {
    uploads++;
    expect(route.request().headers()["content-type"]).toBe("video/mp4");
    expect(route.request().postDataBuffer()).toEqual(video);
    await route.fulfill({
      status: 201,
      json: { data: { videoUrl: "https://media.example.com/video.mp4" } },
    });
  });
  await page.route(/\/reels$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    publishes++;
    expect(route.request().postDataJSON()).toEqual({
      videoUrl: "https://media.example.com/video.mp4",
      caption: "New bag",
      productId: "product-1",
    });
    await route.fulfill({
      status: 201,
      json: { data: { id: "published-reel" } },
    });
  });
  await page.goto("/seller/reels");
  await expect(
    page.getByRole("button", { name: "Publish Reel", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Choose a video")
    .setInputFiles({ name: "phone.mp4", mimeType: "video/mp4", buffer: video });
  await page.getByLabel("Caption").fill("New bag");
  await page.getByLabel("Link a product (optional)").selectOption("product-1");
  await expect(
    page.getByRole("option", { name: "Hidden product" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Publish Reel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Reel is live" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View your Reel" }),
  ).toHaveAttribute("href", "/reels?reel=published-reel");
  expect(uploads).toBe(1);
  expect(publishes).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("publishing failure retains the uploaded video for retry", async ({
  page,
}) => {
  await seller(page);
  let uploads = 0,
    publishes = 0;
  await page.route(/\/seller\/reels\/media$/, (route) => {
    uploads++;
    return route.fulfill({
      status: 201,
      json: { data: { videoUrl: "https://media.example.com/video.mp4" } },
    });
  });
  await page.route(/\/reels$/, (route) => {
    if (route.request().method() !== "POST") return route.continue();
    publishes++;
    return route.fulfill(
      publishes === 1
        ? {
            status: 503,
            json: { error: { message: "Publishing temporarily unavailable" } },
          }
        : { status: 201, json: { data: { id: "retry-reel" } } },
    );
  });
  await page.goto("/seller/reels");
  await page
    .getByLabel("Choose a video")
    .setInputFiles({ name: "phone.mp4", mimeType: "video/mp4", buffer: video });
  await page.getByRole("button", { name: "Publish Reel", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Publishing temporarily unavailable",
  );
  await page.getByRole("button", { name: "Publish Reel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Reel is live" }),
  ).toBeVisible();
  expect(uploads).toBe(1);
  expect(publishes).toBe(2);
});
test("guests cannot reach the video publishing form", async ({ page }) => {
  await page.goto("/seller/reels");
  await expect(
    page.getByText("Sign in to publish a Reel.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Choose a video")).toHaveCount(0);
});
