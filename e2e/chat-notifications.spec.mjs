import { expect, test } from "@playwright/test";

// Isolated browser fixtures only. Application screens never import this data.
const seller = {
  id: "qa-store",
  userId: "qa-seller-user",
  displayName: "QA Store",
};
async function fixtures(page, now = Date.now()) {
  const state = {
    mode: "loaded",
    writeFailure: false,
    sellerFailure: false,
    photo: "/figma/logo.svg",
    writes: [],
    reads: 0,
    release: null,
  };
  const notifications = [
    {
      id: "qa-order",
      type: "ORDER",
      title: "Your order is on the way",
      body: "Order update from your store",
      createdAt: new Date(now - 120000).toISOString(),
      readAt: null,
    },
    {
      id: "qa-message",
      type: "SOCIAL",
      title: "Your store replied",
      body: "Open your conversation",
      createdAt: new Date(now - 1080000).toISOString(),
      readAt: null,
    },
    {
      id: "qa-promo",
      type: "SYSTEM",
      title: "Price drop on a saved item",
      body: "A saved item has an update",
      createdAt: new Date(now - 3600000).toISOString(),
      readAt: new Date().toISOString(),
    },
  ];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let data = { data: [] };
    if (
      state.sellerFailure &&
      (path === "/sellers" || path === `/sellers/${seller.id}`)
    )
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Could not load stores" },
        }),
      });
    if (path === "/users/me")
      data = {
        id: seller.userId,
        name: seller.displayName,
        email: "qa@eazicart.invalid",
      };
    if (path === "/auth/refresh")
      data = {
        tokens: { accessToken: "qa-only", expiresAt: "2099-01-01T00:00:00Z" },
      };
    if (path === "/cart")
      data = { data: { items: [], total: "0", subtotal: "0" } };
    if (path === "/sellers") data = { data: [seller] };
    if (path === `/sellers/${seller.id}`) data = { data: seller };
    if (path === "/social-images/profile")
      data = {
        data: { url: state.photo, uploadedAt: new Date().toISOString() },
      };
    if (path === "/notifications") {
      state.reads++;
      if (state.mode === "loading")
        await new Promise((resolve) => {
          state.release = resolve;
        });
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAVAILABLE", message: "Unavailable" },
          }),
        });
      const visible = state.mode === "empty" ? [] : notifications;
      data = {
        data: visible,
        meta: { unreadCount: visible.filter((n) => !n.readAt).length },
      };
    }
    if (
      path.startsWith("/notifications/") &&
      route.request().method() === "PATCH"
    ) {
      state.writes.push(path);
      if (state.writeFailure)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "UNAVAILABLE",
              message: "Could not mark notifications as read",
            },
          }),
        });
      const items = path.endsWith("read-all")
        ? notifications
        : notifications.filter((n) => path.includes(n.id));
      items.forEach((n) => {
        n.readAt = new Date().toISOString();
      });
      data = path.endsWith("read-all")
        ? { data: { updated: items.length } }
        : { data: items[0] };
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return state;
}

for (const width of [320, 393, 430, 440]) {
  test(`canonical Chat and notification states at ${width}px`, async ({
    page,
  }, testInfo) => {
    const state = await fixtures(page);
    await page.setViewportSize({ width, height: 932 });
    await page.goto("/chat?seller=qa-store");
    const header = page.locator(".eazicart-chat-conversation-header");
    await expect(
      header.getByText(seller.displayName, { exact: true }),
    ).toBeVisible();
    await expect(header.locator("img").last()).toHaveAttribute(
      "src",
      state.photo,
    );
    const back = page.getByRole("link", { name: "Back to chats" });
    const avatar = page.getByRole("link", {
      name: "View QA Store",
      exact: true,
    });
    for (const target of [back, avatar]) {
      const box = await target.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText("Active now", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Today", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Message seller" }),
    ).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`chat-${width}.png`) });
    await page.goto("/notifications");
    await expect(page.locator('[data-figma-node="32:2"]')).toBeVisible();
    const row = page.getByRole("button", {
      name: "Mark Your order is on the way as read",
    });
    expect((await row.boundingBox()).height).toBe(82);
    const skeletonBeforeRead = state.reads;
    await row.click();
    await expect(
      page.getByRole("button", { name: "Your order is on the way, read" }),
    ).toBeDisabled();
    expect(state.reads).toBe(skeletonBeforeRead);
    await page.getByRole("button", { name: "Read all" }).click();
    await expect(page.getByRole("button", { name: "Read all" })).toHaveCount(0);
    expect(state.writes).toEqual([
      "/notifications/qa-order/read",
      "/notifications/read-all",
    ]);
    await page.screenshot({
      path: testInfo.outputPath(`notifications-${width}.png`),
    });
    state.mode = "empty";
    await page.reload();
    await expect(page.locator('[data-figma-node="229:50"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No notifications yet" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`notifications-empty-${width}.png`),
    });
    state.mode = "error";
    await page.reload();
    await expect(page.locator('[data-figma-node="229:116"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`notifications-error-${width}.png`),
    });
    state.mode = "empty";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(
      page.getByRole("heading", { name: "No notifications yet" }),
    ).toBeVisible();
    state.mode = "loading";
    await page.reload();
    await expect(page.locator('[data-figma-node="229:76"]')).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading notifications" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`notifications-loading-${width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    state.mode = "empty";
    state.release?.();
  });
}

test("one seller photo updates everywhere in Chat and after navigation", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.goto("/chat?seller=qa-store");
  const avatars = page.locator('img[src="/figma/logo.svg"]');
  await expect(avatars).toHaveCount(2);
  state.photo = "/figma/bell.svg";
  await page.evaluate(
    ({ userId }) =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "eazicart:profile-photo-refresh",
          newValue: JSON.stringify({ userId, at: Date.now() }),
        }),
      ),
    { userId: seller.userId },
  );
  await expect(page.locator('img[src="/figma/bell.svg"]')).toHaveCount(2);
  await page.goto("/chat");
  await expect(
    page.locator(".eazicart-chat-seller-avatar img"),
  ).toHaveAttribute("src", state.photo);
  await page.locator(".eazicart-chat-seller-row").click();
  await expect(page.locator(".eazicart-chat-store-copy strong")).toHaveText(
    seller.displayName,
  );
  await page.getByRole("link", { name: "Back to chats" }).click();
  await expect(page.locator(".eazicart-chat-seller-row")).toBeVisible();
  await page.goto("/settings");
  await expect(
    page.getByLabel("Account identity").locator("img"),
  ).toHaveAttribute("src", state.photo);
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: "Open side navigation" }).locator("img"),
  ).toHaveAttribute("src", state.photo);
});

test("Chat store list and conversation recover without leaving the page", async ({
  page,
}) => {
  const state = await fixtures(page);
  for (const path of ["/chat", "/chat?seller=qa-store"]) {
    state.sellerFailure = true;
    await page.goto(path);
    await expect(page.getByRole("alert")).toContainText(
      "Could not load stores",
    );
    state.sellerFailure = false;
    await page.getByRole("button", { name: "Try again" }).click();
    if (path.includes("?"))
      await expect(page.locator(".eazicart-chat-store-copy strong")).toHaveText(
        seller.displayName,
      );
    else await expect(page.locator(".eazicart-chat-seller-row")).toBeVisible();
  }
});

test("failed notification read actions preserve unread rows and allow retry", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.goto("/notifications");
  const row = page.getByRole("button", {
    name: "Mark Your order is on the way as read",
  });
  await expect(row).toBeVisible();
  state.writeFailure = true;
  await row.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not mark notifications as read",
  );
  await expect(row).toBeEnabled();
  state.writeFailure = false;
  await row.click();
  await expect(
    page.getByRole("button", { name: "Your order is on the way, read" }),
  ).toBeDisabled();
  state.writeFailure = true;
  const all = page.getByRole("button", { name: "Read all" });
  await all.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not mark notifications as read",
  );
  await expect(
    page.getByRole("button", { name: "Mark Your store replied as read" }),
  ).toBeEnabled();
  await expect(all).toBeEnabled();
  state.writeFailure = false;
  await all.click();
  await expect(
    page.getByRole("button", { name: "Your store replied, read" }),
  ).toBeDisabled();
  await expect(all).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("notification relative times advance without reloading the list", async ({
  page,
}) => {
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  const state = await fixtures(page, now);
  await page.goto("/notifications");
  const row = page.getByRole("button", {
    name: "Mark Your order is on the way as read",
  });
  await expect(row.locator("time")).toHaveText("2m");
  const reads = state.reads;
  await page.clock.fastForward(60_001);
  await expect(row.locator("time")).toHaveText("3m");
  expect(state.reads).toBe(reads);
});
