import { expect, test } from "@playwright/test";

const seller = {
  id: "sidebar-seller",
  userId: "seller-user",
  displayName: "Sidebar Store",
};
const product = {
  id: "sidebar-product",
  name: "Sidebar Product",
  price: "15000",
  stock: 500,
  images: [],
  category: { id: "category", name: "Fashion", slug: "fashion" },
  seller,
};
const user = {
  id: "sidebar-user",
  name: "Test Customer",
  email: "sidebar@example.test",
  username: "customer",
};
async function fixtures(page) {
  let quantity = 12;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body = { data: [] };
    if (path === "/users/me") body = user;
    if (path === "/auth/refresh")
      body = {
        tokens: {
          accessToken: "test",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };
    if (path.startsWith("/cart")) {
      if (route.request().method() !== "GET") quantity = 101;
      body = {
        data: {
          id: "cart",
          items: [
            {
              id: "item",
              quantity,
              product,
              unitPrice: "15000",
              lineTotal: "180000",
            },
          ],
          subtotal: "180000",
          total: "180000",
        },
      };
    }
    if (path === "/notifications")
      body = { data: [], meta: { unreadCount: 3 } };
    if (path === "/products")
      body = {
        data: [product],
        pagination: { page: 1, pages: 1, total: 1, limit: 6 },
      };
    if (path === "/sellers") body = { data: [seller] };
    if (path === "/reels/feed")
      body = {
        data: [
          {
            id: "reel",
            source: "EAZICART",
            product,
            seller,
            caption: "Sidebar reel",
            videoUrl: null,
            _count: { views: 20, likes: 0, saves: 0, comments: 0 },
          },
        ],
        pagination: { hasMore: false, nextCursor: null },
      };
    if (path.startsWith("/social-images")) body = { data: null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("responsive customer shell fits every requested viewport", async ({
  page,
}) => {
  await fixtures(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 393, 430, 768, 1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Cart", exact: true }),
    ).toBeVisible();
    const sidebar = page.getByRole("complementary", {
      name: "Desktop navigation",
    });
    const bottom = page.getByRole("navigation", {
      name: "Customer navigation",
      exact: true,
    });
    if (width < 768) {
      await expect(sidebar).toBeHidden();
      await expect(bottom).toBeVisible();
    } else {
      await expect(sidebar).toBeVisible();
      await expect(bottom).toBeHidden();
      expect((await sidebar.boundingBox()).width).toBe(
        width >= 1200 ? 260 : 80,
      );
      const nav = sidebar.getByRole("navigation");
      await expect(
        nav.getByRole("link", { name: "Cart", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(sidebar.getByText("12", { exact: true })).toBeVisible();
      await expect(sidebar.getByText("3", { exact: true })).toBeVisible();
      const labels = await nav.getByRole("link").all();
      for (const label of labels) {
        const box = await label.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        if (width < 1200) {
          await label.hover();
          await expect(label.getByRole("tooltip")).toBeVisible();
        }
      }
      await expect(
        sidebar.getByRole("link", { name: /Open Test Customer/ }),
      ).toBeVisible();
      const account = await sidebar
        .getByRole("link", { name: /Open Test Customer/ })
        .boundingBox();
      expect(account.y + account.height).toBeGreaterThanOrEqual(870);
      if (width >= 1024) {
        const right = page.getByRole("complementary", {
          name: "Discover on EaziCart",
        });
        await expect(right).toBeVisible();
        const rightBox = await right.boundingBox();
        const content = await page
          .locator("[data-customer-desktop-shell] > div")
          .boundingBox();
        expect(rightBox.x).toBeGreaterThanOrEqual(content.x + content.width);
      }
      await page.evaluate(() => window.scrollTo(0, 500));
      expect((await sidebar.boundingBox()).y).toBe(0);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("desktop links, account, search and existing Sell route work", async ({
  page,
}) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cart");
  const nav = page.getByRole("navigation", {
    name: "Customer desktop navigation",
  });
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(
    nav
      .getByRole("link", { name: "Cart", exact: true })
      .getByText("99+", { exact: true }),
  ).toBeVisible();
  for (const [name, path] of [
    ["Chat", "/chat"],
    ["Notifications", "/notifications"],
    ["Orders", "/orders"],
    ["Saved", "/saved"],
    ["Reels", "/reels"],
    ["Explore", "/explore"],
  ]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await page.getByRole("search").getByRole("textbox").fill("test shoes");
  await page.getByRole("search").getByRole("textbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?search=test%20shoes$/);
  await nav.getByRole("button", { name: "More", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Side navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    nav.getByRole("button", { name: "More", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("complementary", { name: "Desktop navigation" })
    .getByRole("link", { name: "Sell", exact: true })
    .click();
  await expect(page).toHaveURL(/\/seller\/products$/);
  await expect(
    page.getByRole("complementary", { name: "Desktop navigation" }),
  ).toHaveCount(0);
});

test("desktop feed stays central and mobile feed retains its layout", async ({
  page,
}, testInfo) => {
  await fixtures(page);
  for (const width of [393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.locator(".social-home[data-figma-node]:visible"),
    ).toBeVisible();
    const feed = await page
      .locator(".social-home[data-figma-node]:visible")
      .boundingBox();
    expect(feed.width).toBeLessThanOrEqual(650);
    if (width === 1440) expect(feed.width).toBeGreaterThanOrEqual(600);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`feed-${width}.png`) });
  }
});
