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
    ready: (page) =>
      page.getByRole("heading", { name: "Woven everyday tote" }),
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

test("customer entry routes fit a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  for (const route of routes) {
    await page.goto(route.path);
    await expect(route.ready(page)).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.scrollWidth,
      `${route.path} should not scroll horizontally`,
    ).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
