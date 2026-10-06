const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("@playwright/test");
const repo = path.resolve(__dirname, "../..");
const evidence = path.join(__dirname, "captures");
const development = process.env.EAZICART_VERIFY_DEV === "1";
if (development) process.env.EAZICART_TEST_DIST_DIR = ".next-visual";
const next = require(path.join(repo, "apps/web/node_modules/next"));
const app = next({
  dev: development,
  dir: path.join(repo, "apps/web"),
  hostname: "127.0.0.1",
  port: 3100,
  conf: { distDir: development ? ".next-visual" : ".next" },
});
let server;
(async () => {
  let browser;
  try {
    await app.prepare();
    server = require("node:http").createServer(app.getRequestHandler());
    await new Promise((r) => server.listen(3100, "127.0.0.1", r));
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.EAZICART_CHROMIUM_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const product = {
      id: "nike-air-max-90",
      name: "Nike Air Max 90",
      price: "125000",
      stock: 100,
      reel: {
        caption: "New Air Max 90. Built for everyday movement.",
        likesLabel: "12.8K",
        commentsLabel: "428",
      },
      images: [],
      category: { id: "fashion", name: "Fashion", slug: "fashion" },
      seller: { id: "nike", userId: "nike", displayName: "Nike Official" },
    };
    const ts = require(path.join(repo, "apps/web/node_modules/typescript"));
    const configModule = { exports: {} };
    const configCode = ts.transpileModule(
      fs.readFileSync(repo + "/apps/web/app/home-design.ts", "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText;
    new Function("module", "exports", configCode)(
      configModule,
      configModule.exports,
    );
    const homeConfig = configModule.exports.homeDesignProducts;
    const allProducts = homeConfig.map((d, index) => ({
      ...product,
      id: index === 0 ? "nike-air-max-90" : "design-product-" + index,
      name: d.name,
      reel: d.name === product.name ? product.reel : undefined,
      price: d.price,
      images: [{ url: "/figma/" + d.image }],
      seller: { ...product.seller, id: d.seller, displayName: d.seller },
      rating: d.rating,
      soldLabel: d.sold,
      viewsLabel: {
        "iPhone 15 Pro": "18.6K",
        "AirPods Pro 2": "12.4K",
        "Nike Air Max 90": "9.8K",
        "Galaxy S25 Ultra": "8.7K",
      }[d.name],
    }));
    allProducts.push({
      ...product,
      id: "airpods-pro-design",
      name: "AirPods Pro",
      price: "320000",
      images: [{ url: "/figma/airpods-pro-2.jpg" }],
      seller: { ...product.seller, id: "jumia", displayName: "Jumia Nigeria" },
    });
    const nike = {
      ...product,
      images: [{ url: "/figma/nike-air-max-90.jpg" }],
    };
    const hoodie = {
      ...product,
      id: "club-hoodie",
      name: "Club Hoodie",
      price: "78000",
      images: [{ url: "/figma/club-hoodie.jpg" }],
    };
    const cart = {
      id: "cart",
      items: [
        {
          id: "nike-item",
          quantity: 1,
          unitPrice: "125000",
          lineTotal: "125000",
          product: nike,
        },
        {
          id: "hoodie-item",
          quantity: 1,
          unitPrice: "78000",
          lineTotal: "78000",
          product: hoodie,
        },
      ],
      subtotal: "203000",
      total: "203000",
      delivery: "0",
    };
    await page.addInitScript(() =>
      localStorage.setItem(
        "eazicart.auth.tokens",
        JSON.stringify({
          accessToken: "sandbox",
          refreshToken: "sandbox",
          expiresAt: "2099-01-01",
        }),
      ),
    );
    const address = {
      id: "address",
      label: "Home",
      line1: "14 Admiralty Way, Lekki Phase 1",
      line2: null,
      city: "Lagos",
      region: "Lagos",
      postalCode: "",
      country: "Nigeria",
      isDefault: true,
      phone: "+234 803 000 0000",
    };
    const workAddress = {
      ...address,
      id: "work",
      label: "Work",
      line1: "23 Adeola Odeku Street, Victoria Island",
      isDefault: false,
    };
    const order = {
      id: "design-order",
      orderNumber: "EC-2051",
      status: "SHIPPED",
      total: "205500",
      subtotal: "203000",
      delivery: "0",
      serviceFee: "2500",
      receiptSent: true,
      createdAt: "2026-09-10T12:00:00Z",
      updatedAt: "2026-09-10T12:00:00Z",
      address,
      items: [
        {
          id: "one",
          productName: "Nike Air Max 90",
          quantity: 1,
          unitPrice: "125000",
          variantLabel: "Size 41",
          product: nike,
        },
        {
          id: "two",
          productName: "Club Hoodie",
          quantity: 1,
          unitPrice: "78000",
          product: hoodie,
        },
      ],
    };
    order.tracking = {
      map: "LEKKI_REFERENCE",
      statusLabel: "Rider heading to store",
      etaLabel: "12 min",
      distanceLabel: "1.1 km away",
      rider: {
        name: "Tunde A.",
        shortName: "Tunde",
        vehicle: "Honda bike",
        phone: "+2348030000000",
        x: 244,
        y: 378,
      },
      progress: "HEADING_TO_STORE",
      live: true,
    };
    let paymentStatus = "PENDING";
    const payment = () => ({
      id: "payment",
      orderId: order.id,
      reference: "sandbox",
      status: paymentStatus,
      amount: "205500",
      currency: "NGN",
      methodLabel: "EaziCart Wallet",
    });
    const writes = [];
    let saved = false;
    let profileFixture = false;
    let continuationFixture = false;
    let authLoginMode = "success";
    let failCartUpdate = false;
    await page.route("http://localhost:3001/**", async (r) => {
      const path = new URL(r.request().url()).pathname;

      if (path === "/auth/login") {
        if (authLoginMode === "slow")
          await new Promise((resolve) => setTimeout(resolve, 1400));
        if (authLoginMode === "invalid")
          return r.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "INVALID_CREDENTIALS",
                message: "Email or password is incorrect",
              },
            }),
          });
        return r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "wisdom",
              name: "Wisdom Okereke",
              email: "qa@eazicart.invalid",
            },
            tokens: {
              accessToken: "sandbox",
              refreshToken: "sandbox",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          }),
        });
      }
      if (
        failCartUpdate &&
        path.startsWith("/cart/items/") &&
        r.request().method() === "PATCH"
      )
        return r.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Sandbox quantity update failed" }),
        });
      if (
        path.startsWith("/cart/items/") &&
        r.request().method() === "DELETE"
      ) {
        cart.items = cart.items.filter(
          (item) => item.id !== path.split("/").pop(),
        );
        cart.total = cart.subtotal = String(
          cart.items.reduce((v, i) => v + Number(i.lineTotal), 0),
        );
      }
      let data =
        path === "/users/me"
          ? {
              id: "wisdom",
              name: "Wisdom Okereke",
              username: "lhilwick",
              email: "qa@eazicart.invalid",
            }
          : path.startsWith("/products/")
            ? {
                data: path.endsWith("/nike-air-max-90")
                  ? product
                  : allProducts.find((p) => p.id === path.split("/").pop()),
              }
            : path === "/cart"
              ? { data: cart }
              : { data: [] };
      if (path === "/notifications")
        data = { data: [], meta: { unreadCount: 2 } };
      if (path === "/products")
        data = {
          data: allProducts,
          pagination: {
            total: allProducts.length,
            limit: 20,
            offset: 0,
          },
        };
      if (path === "/categories")
        data = {
          data: [
            { id: "fashion", name: "Fashion", slug: "fashion" },
            { id: "electronics", name: "Electronics", slug: "electronics" },
            { id: "beauty", name: "Beauty", slug: "beauty" },
            { id: "home", name: "Home", slug: "home" },
            { id: "sports", name: "Sports", slug: "sports" },
          ],
        };
      if (path === "/orders")
        data = {
          data: Array.from({ length: profileFixture ? 12 : 3 }, () => order),
        };
      if (path === "/following") {
        const continuationFollows = [
          {
            followerId: "wisdom",
            sellerId: "nike",
            seller: {
              id: "nike-user",
              name: "Nike Official",
              sellerProfile: {
                id: "nike",
                displayName: "Nike Official",
                bio: "Performance footwear and everyday essentials.",
              },
            },
          },
          {
            followerId: "wisdom",
            sellerId: "jumia",
            seller: {
              id: "jumia-user",
              name: "Jumia Nigeria",
              sellerProfile: {
                id: "jumia",
                displayName: "Jumia Nigeria",
                bio: "Popular technology and lifestyle products.",
              },
            },
          },
        ];
        data = {
          data: continuationFixture
            ? continuationFollows
            : profileFixture
              ? Array.from({ length: 14 }, (_, index) => ({
                  ...continuationFollows[index % continuationFollows.length],
                  sellerId: `profile-follow-${index}`,
                }))
              : [],
        };
      }
      if (/^\/sellers\/[^/]+\/followers\/count$/.test(path))
        data = { data: { count: path.includes("nike") ? 12840 : 8420 } };
      if (path === "/addresses") data = { data: [address, workAddress] };
      if (path.startsWith("/orders/")) data = { data: order };
      if (path.startsWith("/payments/")) data = { data: payment() };
      if (path.startsWith("/cart/items/") && r.request().method() === "PATCH") {
        const body = r.request().postDataJSON();
        const item = cart.items.find((i) => i.id === path.split("/").pop());
        item.quantity = body.quantity;
        item.lineTotal = String(Number(item.unitPrice) * body.quantity);
        cart.total = cart.subtotal = String(
          cart.items.reduce((v, i) => v + Number(i.lineTotal), 0),
        );
      }
      if (r.request().method() !== "GET") {
        writes.push({
          path,
          method: r.request().method(),
          body: r.request().postDataJSON(),
        });
        data = { data: {} };
      }
      if (path === "/orders" && r.request().method() === "POST")
        data = { data: order };
      if (path === "/payments/initialize")
        data = {
          data: {
            ...payment(),
            authorizationUrl:
              "http://127.0.0.1:3100/payment-pending?reference=sandbox",
          },
        };
      if (path.startsWith("/saved-products/"))
        saved = r.request().method() === "POST";
      if (path === "/saved-products")
        data = {
          data:
            profileFixture || continuationFixture
              ? allProducts.slice(0, 8).map((item) => ({
                  productId: item.id,
                  product: item,
                }))
              : saved
                ? [{ productId: product.id, product }]
                : [],
        };
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto("http://127.0.0.1:3100/product/nike-air-max-90");
    await page.locator('[data-figma-node="8:54"]').waitFor();
    await page.evaluate(() =>
      Promise.all([
        document.fonts.ready,
        ...Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              }),
        ),
      ]),
    );
    await page.screenshot({ path: evidence + "/product-app.png" });
    for (const width of [360, 375, 390, 440]) {
      await page.setViewportSize({ width, height: 932 });
      await page.screenshot({ path: evidence + `/product-app-${width}.png` });
      const sizes = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      if (sizes.page > width) throw Error("Overflow " + width);
    }
    await page.getByRole("button", { name: "42", exact: true }).click();
    if (
      (await page
        .getByRole("button", { name: "42", exact: true })
        .getAttribute("aria-pressed")) !== "true"
    )
      throw Error("Size selection failed");
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Added to cart" })
      .waitFor();
    console.log(
      JSON.stringify({
        errors,
        viewportWidths: [430, 360, 375, 390, 440],
        tested: ["size selection", "sandbox add to cart"],
        complete: true,
      }),
    );
    await page.setViewportSize({ width: 430, height: 932 });
    await page.setContent(
      '<html><body style="margin:0">' +
        fs.readFileSync(evidence + "/references/product.svg", "utf8") +
        "</body></html>",
    );
    await page.screenshot({ path: evidence + "/product-reference.png" });
    await page.goto("http://127.0.0.1:3100/cart");
    await page.getByText("Nike Air Max 90", { exact: true }).waitFor();
    await page.evaluate(() =>
      Promise.all([
        document.fonts.ready,
        ...Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              }),
        ),
      ]),
    );
    await page.screenshot({ path: evidence + "/cart-app.png" });
    for (const width of [360, 375, 390, 440]) {
      await page.setViewportSize({ width, height: 932 });
      await page.screenshot({ path: evidence + `/cart-app-${width}.png` });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Cart overflow " + width);
    }
    await page
      .getByRole("button", { name: "Increase quantity" })
      .first()
      .click();
    await page.getByText("3 items", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Decrease quantity" })
      .first()
      .click();
    await page.getByText("2 items", { exact: true }).waitFor();
    if (
      (await page
        .getByRole("link", { name: "Cart", exact: true })
        .getAttribute("aria-current")) !== "page"
    )
      throw Error("Cart nav not active");
    const captureState = async (name, node) => {
      await page.setViewportSize({ width: 430, height: 932 });
      await page.locator(`[data-figma-node="${node}"]`).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence + `/${name}-app.png` });
      for (const width of [360, 375, 390, 440]) {
        await page.setViewportSize({ width, height: 932 });
        await page.screenshot({ path: evidence + `/${name}-app-${width}.png` });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw Error(name + " overflow");
      }
      await page.setViewportSize({ width: 430, height: 932 });
    };

    const captureContinuation = async (name, ready) => {
      await page.setViewportSize({ width: 430, height: 932 });
      await ready.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence + `/${name}-app.png` });
      for (const width of [360, 375, 390, 440]) {
        await page.setViewportSize({ width, height: 932 });
        await page.screenshot({
          path: evidence + `/${name}-app-${width}.png`,
        });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw Error(name + " overflow " + width);
      }
      await page.setViewportSize({ width: 430, height: 932 });
    };
    await page
      .getByRole("button", { name: "Decrease quantity" })
      .first()
      .click();
    await captureState("cart-remove", "228:68");
    await page.getByRole("button", { name: "Keep item", exact: true }).click();
    await page.getByText("2 items", { exact: true }).waitFor();
    failCartUpdate = true;
    await page
      .getByRole("button", { name: "Increase quantity" })
      .first()
      .click();
    await captureState("cart-error", "228:113");
    failCartUpdate = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText("3 items", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Decrease quantity" })
      .first()
      .click();
    await page.getByText("2 items", { exact: true }).waitFor();
    failCartUpdate = true;
    await page
      .getByRole("button", { name: "Increase quantity" })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Keep previous cart", exact: true })
      .click();
    failCartUpdate = false;
    await page.getByText("2 items", { exact: true }).waitFor();
    const originalItems = cart.items.slice();
    nike.stock = 0;
    cart.items[0].variantLabel = "Size 41";
    await page.reload();
    await captureState("cart-unavailable", "228:91");
    await page
      .getByRole("button", { name: "Remove item", exact: true })
      .click();
    await page.getByText("1 item", { exact: true }).waitFor();
    if (
      await page
        .getByRole("link", { name: "View Nike Air Max 90", exact: true })
        .count()
    )
      throw Error("Unavailable item not removed");
    nike.stock = 100;
    cart.items = originalItems;
    cart.total = cart.subtotal = "203000";
    cart.items = [];
    cart.total = cart.subtotal = "0";
    await page.reload();
    await captureState("cart-empty", "228:50");
    await page
      .getByRole("link", { name: "Explore products", exact: true })
      .click();
    await page.waitForURL("**/explore");
    cart.items = originalItems;
    cart.total = cart.subtotal = "203000";
    await page.setViewportSize({ width: 430, height: 932 });
    await page.setContent(
      '<html><body style="margin:0">' +
        fs.readFileSync(evidence + "/references/cart.svg", "utf8") +
        "</body></html>",
    );
    await page.screenshot({ path: evidence + "/cart-reference.png" });
    console.log(
      JSON.stringify({
        screen: "cart",
        tested: ["quantity increase", "quantity decrease", "cart active state"],
        errors,
      }),
    );
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("http://127.0.0.1:3100/");
    await page
      .getByRole("link", { name: "View Nike Air Max 90", exact: true })
      .waitFor();
    await page.evaluate(() =>
      Promise.all([
        document.fonts.ready,
        ...Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              }),
        ),
      ]),
    );
    await page.screenshot({ path: evidence + "/home-app.png" });
    await page.screenshot({
      path: evidence + "/home-app-full.png",
      fullPage: true,
    });
    for (const width of [360, 375, 390, 440]) {
      await page.setViewportSize({ width, height: 932 });
      await page.screenshot({ path: evidence + `/home-app-${width}.png` });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Home overflow " + width);
    }
    await page.setViewportSize({ width: 430, height: 932 });
    await page.getByRole("button", { name: "Open side navigation" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").getByText("3", { exact: true }).waitFor();
    await page.screenshot({ path: evidence + "/drawer-app.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.setContent(
      '<html><body style="margin:0">' +
        fs.readFileSync(evidence + "/references/home.svg", "utf8") +
        "</body></html>",
    );
    await page.screenshot({ path: evidence + "/home-reference.png" });
    await page.setContent(
      '<html><body style="margin:0">' +
        fs.readFileSync(evidence + "/references/drawer.svg", "utf8") +
        "</body></html>",
    );
    await page.screenshot({ path: evidence + "/drawer-reference.png" });
    cart.serviceFee = "2500";
    cart.total = "205500";
    for (const [name, path] of [
      ["explore", "/explore"],
      ["reels", "/reels"],
      ["checkout", "/checkout"],
      ["pending", "/payment-pending?reference=sandbox"],
      ["success", "/payment-success?orderId=design-order"],
      ["order", "/orders/design-order"],
      ["tracking", "/tracking/design-order"],
    ]) {
      if (name === "success") paymentStatus = "SUCCESS";
      await page.setViewportSize({ width: 430, height: 932 });
      await page.goto("http://127.0.0.1:3100" + path);
      await page.locator("[data-figma-node]").waitFor();
      await page.evaluate(() =>
        Promise.all([
          document.fonts.ready,
          ...Array.from(document.images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
                }),
          ),
        ]),
      );
      if (name === "explore")
        await page.getByText("AirPods Pro", { exact: true }).waitFor();
      if (name === "reels")
        await page.getByText("Nike Air Max 90", { exact: true }).waitFor();
      if (name === "pending")
        await page.getByText("₦205,500", { exact: true }).waitFor();
      await page.screenshot({ path: evidence + `/${name}-app.png` });
      for (const width of [360, 375, 390, 440]) {
        await page.setViewportSize({ width, height: 932 });
        await page.screenshot({ path: evidence + `/${name}-app-${width}.png` });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw Error(name + " overflow " + width);
      }
      await page.setViewportSize({ width: 430, height: 932 });
      await page.setContent(
        '<html><body style="margin:0">' +
          (["reels", "explore"].includes(name)
            ? `<img width=430 height=932 src="data:image/png;base64,${fs.readFileSync(evidence + `/${name}-reference.png`).toString("base64")}" />`
            : fs.readFileSync(evidence + `/references/${name}.svg`, "utf8")) +
          "</body></html>",
      );
      await page.screenshot({ path: evidence + `/${name}-reference.png` });
    }
    paymentStatus = "PENDING";
    await page.goto("http://127.0.0.1:3100/");
    await page.getByRole("button", { name: "Open side navigation" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.keyboard.press("Shift+Tab");
    if ((await page.locator(":focus").textContent()) !== "Settings")
      throw Error("Drawer focus does not wrap to last link");
    await page.keyboard.press("Tab");
    if (
      (await page.locator(":focus").getAttribute("aria-label")) !== "Close menu"
    )
      throw Error("Drawer focus does not wrap to close");
    for (const width of [360, 375, 390, 440]) {
      await page.setViewportSize({ width, height: 932 });
      await page.screenshot({ path: evidence + `/drawer-app-${width}.png` });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Drawer overflow");
    }
    await page.setViewportSize({ width: 430, height: 932 });
    const isolationStyle = await page.addStyleTag({
      content:
        'main.app-shell > :not([data-figma-node="560:3187"]) {visibility:hidden;} main.app-shell {background:white;}',
    });
    // The focus-wrap assertions above intentionally leave the close control focused.
    // Blur only for the neutral visual comparison; Escape still closes the dialog
    // and the component cleanup restores focus to the avatar trigger.
    await dialog
      .getByRole("button", { name: "Close menu" })
      .evaluate((el) => el.blur());
    await page.screenshot({ path: evidence + "/drawer-isolated-app.png" });
    await isolationStyle.evaluate((el) => el.remove());
    await page.keyboard.press("Escape");
    if (
      (await page.locator(":focus").getAttribute("aria-label")) !==
      "Open side navigation"
    )
      throw Error("Drawer focus restore");
    await page.reload();
    await page
      .getByRole("link", { name: "View Nike Air Max 90", exact: true })
      .click();
    await page.locator('[data-figma-node="8:54"]').waitFor();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Unsave product", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Unsave product", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Unsave product", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Buy Now", exact: true }).click();
    await page.waitForURL("**/checkout");
    await page.getByRole("link", { name: "Change", exact: true }).click();
    await captureState("address-select", "228:214");
    await page.getByRole("radio").filter({ hasText: "WORK" }).click();
    await page.getByRole("link", { name: "Use selected address" }).click();
    await page.waitForURL("**/checkout?addressId=work");
    await page.getByText(workAddress.line1, { exact: true }).waitFor();
    await page.getByRole("link", { name: "Change", exact: true }).click();
    await page.getByRole("radio").filter({ hasText: "HOME" }).click();
    await page.getByRole("link", { name: "Use selected address" }).click();
    await page.waitForURL("**/checkout?addressId=address");
    await page.getByText(address.line1, { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Place order", exact: true })
      .click();
    await page.waitForURL("**/payment-pending?reference=sandbox");
    await page
      .getByRole("button", { name: "Check payment status", exact: true })
      .waitFor();
    if (
      !writes.some(
        (w) => w.path === "/orders" && w.body.addressId === address.id,
      )
    )
      throw Error("Order address not preserved");
    if (
      !writes.some(
        (w) => w.path === "/payments/initialize" && w.body.orderId === order.id,
      )
    )
      throw Error("Payment order not preserved");
    paymentStatus = "SUCCESS";
    await page
      .getByRole("button", { name: "Check payment status", exact: true })
      .click();
    await page.waitForURL("**/payment-success?orderId=design-order");
    await page
      .getByRole("heading", { name: "Order confirmed", exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Track order", exact: true }).click();
    await page.waitForURL("**/tracking/design-order");
    await page.getByText("Live delivery", { exact: true }).waitFor();
    const call = page.getByRole("link", { name: "Call", exact: true });
    if ((await call.getAttribute("href")) !== "tel:+2348030000000")
      throw Error("Call rider phone mismatches provider");
    await page
      .getByRole("link", { name: "Order Details", exact: true })
      .click();
    await page.waitForURL("**/orders/design-order");
    await page
      .getByRole("link", { name: "Track package", exact: true })
      .click();
    await page.waitForURL("**/tracking/design-order");
    paymentStatus = "PENDING";
    await page.goto(
      "http://127.0.0.1:3100/payment-success?orderId=design-order",
    );
    await page
      .getByText("Payment has not been confirmed.", { exact: true })
      .waitFor();
    if (
      await page
        .getByRole("heading", { name: "Order confirmed", exact: true })
        .count()
    )
      throw Error("Unconfirmed payment reported as success");
    for (const [status, title] of [
      ["FAILED", "Payment wasn’t completed"],
      ["REVIEW_REQUIRED", "Payment received — review needed"],
    ]) {
      paymentStatus = status;
      await page.goto(
        "http://127.0.0.1:3100/payment-pending?reference=sandbox",
      );
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      if (status === "FAILED") {
        await page.getByText("Checkout · #EC-2051", { exact: true }).waitFor();
        await captureState("payment-failed", "212:122");
      }
    }
    const tracking = order.tracking;
    delete order.tracking;
    await page.goto("http://127.0.0.1:3100/tracking/design-order");
    await page
      .getByText("Detailed delivery tracking isn’t available yet.", {
        exact: true,
      })
      .waitFor();
    if (await page.getByText("Tunde A.", { exact: true }).count())
      throw Error("Rider invented without tracking data");
    order.tracking = tracking;
    if (errors.length) throw Error("Browser errors: " + errors.join("; "));
    profileFixture = true;
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("http://127.0.0.1:3100/profile");
    await page.getByText("12", { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence + "/profile-app.png" });
    for (const width of [360, 375, 390, 440]) {
      await page.setViewportSize({ width, height: 932 });
      await page.screenshot({ path: evidence + `/profile-app-${width}.png` });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Profile overflow");
    }
    continuationFixture = true;

    await page.goto("http://127.0.0.1:3100/saved");
    await captureContinuation(
      "saved",
      page.getByRole("region", { name: "Saved products" }),
    );

    await page.goto("http://127.0.0.1:3100/following");
    await captureContinuation("following", page.getByLabel("Followed sellers"));

    await page.goto("http://127.0.0.1:3100/reviews");
    await captureContinuation(
      "reviews-history",
      page.getByRole("heading", {
        name: "Reviews are not available yet",
        exact: true,
      }),
    );

    await page.goto("http://127.0.0.1:3100/category/fashion");
    await page.locator('[data-figma-node="31:50"]').waitFor();
    await page.getByText("Nike Air Max 90", { exact: true }).first().waitFor();
    await captureState("category", "31:50");

    await page.goto("http://127.0.0.1:3100/address-book");
    await page.getByRole("button", { name: /Add new address/ }).click();
    await captureContinuation(
      "profile-address-add",
      page.getByRole("heading", {
        name: "Add delivery address",
        exact: true,
      }),
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await captureContinuation(
      "profile-address-edit",
      page.getByRole("heading", {
        name: "Edit delivery address",
        exact: true,
      }),
    );

    await page.goto(
      "http://127.0.0.1:3100/address-book?checkout=1&selectedId=address",
    );
    await page.getByRole("button", { name: "+ Add new address" }).click();
    await captureState("checkout-address-add", "212:36");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Edit Home", exact: true }).click();
    await captureState("checkout-address-edit", "212:70");

    await page.goto("http://127.0.0.1:3100/login");
    await captureContinuation(
      "login",
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    );

    authLoginMode = "invalid";
    await page.getByLabel("Email address").fill("wrong@eazicart.invalid");
    await page
      .getByLabel("Password", { exact: true })
      .fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Email or password is incorrect. Try again." })
      .waitFor();
    await captureContinuation(
      "login-invalid",
      page.getByRole("alert").filter({
        hasText: "Email or password is incorrect. Try again.",
      }),
    );

    authLoginMode = "slow";
    await page.goto("http://127.0.0.1:3100/login");
    await page.getByLabel("Email address").fill("qa@eazicart.invalid");
    await page.getByLabel("Password", { exact: true }).fill("sandbox-pass");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Checking your details…" })
      .waitFor();
    await captureContinuation(
      "login-loading",
      page.getByRole("status").filter({ hasText: "Checking your details…" }),
    );
    await page.waitForURL("http://127.0.0.1:3100/");
    authLoginMode = "success";

    await page.goto("http://127.0.0.1:3100/register");
    await captureContinuation(
      "register",
      page.getByRole("heading", { name: "Create account", exact: true }),
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.getByText("Enter your full name.", { exact: true }).waitFor();
    await captureContinuation(
      "register-validation",
      page.getByText("Enter your full name.", { exact: true }),
    );

    order.tracking.animateReference = true;
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("http://127.0.0.1:3100/tracking/design-order");
    const rider = page.getByText("Tunde", { exact: true }).locator("..");
    await rider.waitFor();
    const animationDuration = await rider.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    );
    if (animationDuration !== "8s")
      throw Error("Reference rider duration differs from Figma");
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (
      (await rider.evaluate((el) => getComputedStyle(el).animationName)) !==
      "none"
    )
      throw Error("Reduced motion is not respected");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    order.tracking.animateReference = false;
    await page.setViewportSize({ width: 375, height: 520 });
    await page.goto("http://127.0.0.1:3100/explore");
    const searchInput = page.getByRole("textbox", {
      name: "Search products, stores or brands",
    });
    await searchInput.fill("Nike");
    const inputRect = await searchInput.boundingBox();
    if (inputRect.y + inputRect.height > 432)
      throw Error("Search covered by bottom navigation at reduced height");
    await searchInput.press("Enter");
    await page.waitForURL("**/search?search=Nike");
    await page.goto("http://127.0.0.1:3100/product/design-product-2");
    await page.getByText("iPhone 15 Pro", { exact: true }).waitFor();
    if (await page.locator('[data-figma-node="8:54"]').count())
      throw Error("Non-Nike product routed to Nike detail");
    await page.goto("http://127.0.0.1:3100/reels?productId=design-product-2");
    await page.getByText("iPhone 15 Pro", { exact: true }).waitFor();
    if (
      (await page
        .getByRole("link", { name: "View Product" })
        .getAttribute("href")) !== "/product/design-product-2"
    )
      throw Error("Reel linked unrelated product");
    if (
      await page
        .getByText("New Air Max 90. Built for everyday movement.", {
          exact: true,
        })
        .count()
    )
      throw Error("Non-Nike reel received Nike copy");
    if (errors.length) throw Error("Browser errors: " + errors.join("; "));
    fs.writeFileSync(
      evidence + "/interaction-results.json",
      JSON.stringify(
        {
          passed: true,
          tested: [
            "Nike-only Home detail link",
            "save/unsave persisted through reload",
            "Buy Now cart mutation and checkout",
            "delivery address selection and checkout round trip",
            "create order with selected address",
            "sandbox payment initialization for same order",
            "Pending → verified Success",
            "Success → same-order Tracking",
            "Tracking → same-order detail → Tracking",
            "rider telephone href only",
            "unconfirmed success guard",
            "failed payment",
            "review required payment",
            "missing tracking provider fallback",
            "drawer focus wrap/restore and Escape",
            "cart removal cancellation",
            "failed cart quantity update retry",
            "keep previous cart after failed update",
            "out of stock removal",
            "empty cart Explore navigation",
            "eight-second reference rider motion",
            "reduced-motion preference",
            "search Enter submission at 375×520 reduced viewport",
            "non-Nike detail guard",
            "Reels selected product identity",
            "continuation Saved responsive capture",
            "continuation Following responsive capture",
            "continuation Reviews History responsive capture",
            "continuation Category responsive capture",
            "profile address add/edit responsive capture",
            "checkout address add/edit responsive capture",
            "Login invalid/loading responsive capture",
            "Register validation responsive capture",
          ],
          writes,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        screens: [
          "home",
          "product",
          "cart",
          "checkout",
          "pending",
          "success",
          "order",
          "tracking",
          "drawer",
          "profile",
          "reels",
          "explore",
          "cart-empty",
          "cart-remove",
          "cart-error",
          "cart-unavailable",
          "payment-failed",
          "address-select",
          "saved",
          "following",
          "reviews-history",
          "category",
          "profile-address-add",
          "profile-address-edit",
          "checkout-address-add",
          "checkout-address-edit",
          "login",
          "login-invalid",
          "login-loading",
          "register",
          "register-validation",
        ],
        widths: [430, 360, 375, 390, 440],
        errors,
      }),
    );
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    await app.close();
  }
})()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
    if (server) server.close();
    process.exit(1);
  });
