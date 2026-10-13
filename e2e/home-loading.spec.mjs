import { expect, test } from "@playwright/test";
const api = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

for (const width of [320, 393, 440]) {
  test(`Home prioritizes its first photo and defers offscreen media at ${width}px`, async ({
    page,
    request,
  }) => {
    const response = await request.get(`${api}/products?limit=100`);
    expect(response.ok()).toBe(true);
    const catalog = await response.json();
    const photo = "https://qa-store.public.blob.vercel-storage.com/product.png";
    const fresh = {
      ...catalog,
      data: catalog.data.map((p) => ({
        ...p,
        images: [{ url: photo, altText: p.name, position: 0 }],
      })),
    };
    // Isolated media fixture with real catalog identities; no production fixture data.
    await page.route(/\/products(?:\?|$)/, (route) =>
      route.fulfill({ json: fresh }),
    );
    await page.route("**/_next/image?**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="440" height="440"><rect width="440" height="440" fill="#dedede"/></svg>',
      }),
    );
    await page.setViewportSize({ width, height: 932 });
    await page.goto("/");
    const hero = page.locator(".social-home-feature-image");
    await expect(hero).toHaveAttribute("src", /\/_next\/image\?/);
    const source = new URL(
      await hero.getAttribute("src"),
      "http://localhost:3000",
    );
    expect(source.searchParams.get("url")).toBe(photo);
    await expect(hero).toHaveAttribute("loading", "eager");
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    await expect(hero).toHaveAttribute("sizes", /416px/);
    const cards = page.locator(
      ".social-home-product-media img, .social-home-editorial-media > img, .figma-home-product-media img",
    );
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute("loading", "lazy");
      await expect(card).toHaveAttribute("decoding", "async");
    }
    expect(
      await page.evaluate(
        () =>
          Array.from(document.images).filter((i) => i.loading !== "lazy")
            .length,
      ),
    ).toBeLessThanOrEqual(2);
    await page.reload();
    await expect(hero).toHaveAttribute("src", /\/_next\/image\?/);
  });
}
