import { test, expect } from "@playwright/test";

for (const variant of ["pro", "business"]) {
  test(`${variant} badges across existing account-name surfaces`, async ({
    page,
  }, info) => {
    const badge = {
      variant,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const user = {
      id: "member-1",
      name: "Fixture Member",
      email: "fixture@eazicart.invalid",
      badge,
    };
    const seller = {
      id: "shop-1",
      userId: user.id,
      displayName: "Fixture Shop",
      bio: "Isolated browser fixture",
      badge,
      _count: { products: 1 },
      location: {
        latitude: 6.45,
        longitude: 3.39,
        label: "Fixture location",
        visible: true,
      },
    };
    const category = { id: "home", slug: "home", name: "Home" };
    const product = {
      id: "product-1",
      name: "Fixture Lamp",
      description: "Browser-only product",
      price: "12000",
      stock: 4,
      active: true,
      category,
      seller,
      images: [{ url: "/demo/desk-lamp.svg", altText: "Fixture lamp" }],
    };
    const reel = {
      id: "reel-1",
      source: "EAZICART",
      caption: "Fixture reel",
      seller,
      product,
      thumbnailUrl: "/demo/desk-lamp.svg",
      videoUrl: null,
      _count: { likes: 1, saves: 0, views: 1, comments: 1 },
    };
    const customer = {
      id: user.id,
      name: user.name,
      badge,
      orders: 1,
      units: 1,
      firstOrderAt: "2026-01-01",
      latestOrderAt: "2026-01-02",
      location: { city: "Lagos", region: "Lagos", country: "Nigeria" },
    };
    await page.route("http://localhost:3001/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      let result;
      if (path === "/users/me") result = user;
      else if (path === "/products")
        result = {
          data: [product],
          pagination: { page: 1, limit: 100, total: 1, pages: 1 },
        };
      else if (path === "/categories") result = { data: [category] };
      else if (path === "/products/product-1") result = { data: product };
      else if (path === "/sellers" || path === "/map/sellers")
        result = { data: [seller] };
      else if (path === "/sellers/shop-1" || path === "/seller-profile")
        result = { data: seller };
      else if (path === "/sellers/shop-1/products")
        result = { data: [product] };
      else if (path.endsWith("/followers/count"))
        result = { data: { count: 1 } };
      else if (path === "/following")
        result = {
          data: [
            {
              followerId: "viewer",
              sellerId: user.id,
              seller: {
                id: user.id,
                name: user.name,
                badge,
                sellerProfile: seller,
              },
            },
          ],
        };
      else if (path === "/saved-products")
        result = {
          data: [{ userId: user.id, productId: product.id, product }],
        };
      else if (path === "/cart")
        result = { data: { id: "cart", items: [], subtotal: "0", total: "0" } };
      else if (path === "/notifications")
        result = { data: [], meta: { unreadCount: 0 } };
      else if (path === "/reels/feed")
        result = {
          data: [reel],
          pagination: { nextCursor: null, hasMore: false },
        };
      else if (path === "/reels/reel-1/interactions")
        result = { data: { liked: false, saved: false } };
      else if (path === "/reels/reel-1/views")
        result = { data: { id: "view" } };
      else if (path === "/reels/reel-1/comments")
        result = {
          data: [
            {
              id: "comment-1",
              body: "Fixture comment",
              user,
              userId: user.id,
              reelId: reel.id,
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        };
      else if (path === "/seller/customers") result = { data: [customer] };
      else if (path === `/seller/customers/${user.id}`)
        result = { data: { customer, orders: [] } };
      else if (path === "/verification/badges")
        result = { data: { [user.id]: badge } };
      else
        return route.fulfill({
          status: 404,
          headers,
          json: { error: { code: "FIXTURE_ROUTE_MISSING", message: path } },
        });
      await route.fulfill({ headers, json: result });
    });
    const label = `Verified ${variant === "pro" ? "Pro" : "Business"} — This account has an active EaziCart ${variant === "pro" ? "Pro" : "Business"} subscription.`;
    const badgeLocator = () =>
      page.getByRole("button", { name: label, exact: true });
    const routes = [
      ["home", "/", 16],
      ["explore", "/explore?section=sellers", 16],
      ["category", "/category/home", 16],
      ["seller", "/seller/shop-1", 16],
      ["product", "/product/product-1", 16],
      ["following", "/following", 16],
      ["saved", "/saved", 16],
      ["profile", "/profile", 20],
      ["customer", `/seller/customers/${user.id}`, 16],
      ["storefront", "/seller/store", 16],
      ["reels", "/reels", 16],
    ];
    for (const [name, route, size] of routes) {
      await test.step(name, async () => {
        await page.goto(route);
        const trigger = badgeLocator().first();
        await expect(trigger).toBeVisible();
        const bounds = await trigger.locator("img").boundingBox();
        expect(bounds.width).toBe(size);
        expect(bounds.height).toBe(size);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        if (["home", "profile", "reels"].includes(name)) {
          await page.screenshot({
            path: `docs/verification-badges/screenshots/${info.project.name}-${variant}-${name}.png`,
            fullPage: true,
          });
        }
      });
    }
    await page
      .getByRole("button", { name: "Open reel comments", exact: true })
      .click();
    const comment = page.getByRole("dialog");
    await expect(
      comment.getByText("Fixture comment", { exact: true }),
    ).toBeVisible();
    await expect(
      comment.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
    const location = page.url();
    if (info.project.name === "desktop-chromium")
      await comment.getByRole("button", { name: label, exact: true }).hover();
    else await comment.getByRole("button", { name: label, exact: true }).tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    expect(page.url()).toBe(location);
    await page.screenshot({
      path: `docs/verification-badges/screenshots/${info.project.name}-${variant}-comments.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(comment).toBeVisible();

    // Exercise the actual map details UI without external tiles or a WebGL dependency.
    await page.addInitScript(() => {
      class MapFixture {
        constructor({ container }) {
          this.container = container;
        }
        on(_event, fn) {
          queueMicrotask(fn);
        }
        remove() {
          this.container.replaceChildren();
        }
        fitBounds() {
          return;
        }
        easeTo() {
          return;
        }
        flyTo() {
          return;
        }
        getZoom() {
          return 12;
        }
      }
      class MarkerFixture {
        constructor({ element }) {
          this.element = element;
        }
        setLngLat() {
          return this;
        }
        addTo(map) {
          Object.assign(this.element.style, {
            position: "absolute",
            top: "180px",
            left: "24px",
            zIndex: "20",
          });
          map.container.append(this.element);
          return this;
        }
        remove() {
          this.element.remove();
        }
      }
      class BoundsFixture {
        extend() {
          return this;
        }
        isEmpty() {
          return false;
        }
      }
      window.maplibregl = {
        Map: MapFixture,
        Marker: MarkerFixture,
        LngLatBounds: BoundsFixture,
      };
    });
    await page.goto("/explore/map");
    await page
      .getByRole("button", { name: "View Fixture Shop", exact: true })
      .click();
    await expect(badgeLocator()).toBeVisible();
    await page.screenshot({
      path: `docs/verification-badges/screenshots/${info.project.name}-${variant}-map.png`,
      fullPage: true,
    });
  });
}
