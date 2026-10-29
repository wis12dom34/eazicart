import { expect, test } from "@playwright/test";

const routes = [
  {
    path: "/",
    ready: (page) => page.getByText("Woven everyday tote").first(),
  },
  {
    path: "/explore",
    ready: (page) => page.getByRole("heading", { name: "Explore" }),
  },
  {
    path: "/search?search=Woven",
    ready: (page) =>
      page.getByRole("link", { name: "View Woven everyday tote" }),
  },
  {
    path: "/category/fashion",
    ready: (page) =>
      page.getByRole("heading", { name: "Fashion", exact: true }),
  },
  {
    path: "/product/demo-product-woven-tote",
    ready: (page) => page.getByRole("heading", { name: "Woven everyday tote" }),
  },
  {
    path: "/reels",
    ready: (page) => page.getByRole("heading", { name: "Reels", exact: true }),
  },
  {
    path: "/login",
    ready: (page) =>
      page.getByRole("heading", { name: "Welcome back", exact: true }),
  },
  {
    path: "/register",
    ready: (page) =>
      page.getByRole("heading", { name: "Create account", exact: true }),
  },
];

const viewports = [
  { width: 320, height: 568, label: "320x568" },
  { width: 360, height: 800, label: "360x800" },
  { width: 375, height: 667, label: "375x667" },
  { width: 375, height: 812, label: "375x812" },
  { width: 390, height: 844, label: "390x844" },
  { width: 393, height: 852, label: "393x852" },
  { width: 414, height: 896, label: "414x896" },
  { width: 430, height: 932, label: "430x932" },
  { width: 412, height: 915, label: "tall-android-412x915" },
  { width: 844, height: 390, label: "landscape-844x390" },
];

async function expectNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `${label} document should not scroll horizontally`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(
    dimensions.bodyScrollWidth,
    `${label} body should not scroll horizontally`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

test("customer entry routes fit supported phone viewports", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route.path);
      await expect(route.ready(page)).toBeVisible();
      await expectNoHorizontalOverflow(
        page,
        `${route.path} at ${viewport.label}`,
      );
    }
  }
});

test("Home FYP keeps critical controls inside the viewport", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText("Woven everyday tote").first()).toBeVisible();

    const selectors = [
      ".figma-home-header",
      ".figma-home-search",
      ".figma-home-tabs",
      ".figma-home-story-strip",
      ".social-product-header",
      ".social-product-media",
    ];

    for (const selector of selectors) {
      const element = page.locator(selector).first();
      if ((await element.count()) === 0 || !(await element.isVisible())) continue;
      const box = await element.boundingBox();
      expect(box, `${selector} should have layout at ${viewport.label}`).not.toBeNull();
      if (!box) continue;
      expect(
        box.x,
        `${selector} should not start outside the viewport at ${viewport.label}`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        box.x + box.width,
        `${selector} should not exceed viewport width at ${viewport.label}`,
      ).toBeLessThanOrEqual(viewport.width + 1);
    }

    await expectNoHorizontalOverflow(page, `Home FYP at ${viewport.label}`);
  }
});
