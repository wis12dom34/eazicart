import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalUrl,
  publicIndexingEnabled,
  catalogIndexingEnabled,
  pageMetadata,
  jsonLd,
  siteOrigin,
} from "./seo";
import { productSchema } from "./catalog-schema";
import { publicProduct, getPublicProduct } from "./public-catalog";
import type { Product } from "./api/types";
import { GET as indexGET } from "../app/sitemap-index.xml/route";
import { GET as catalogGET } from "../app/catalog-sitemap/[page]/route";

const product: Product = {
  id: "actual-product",
  name: "Real catalog item",
  description: "Catalog description",
  price: "2500.00",
  stock: 0,
  active: true,
  images: [{ url: "https://images.example.test/item.jpg" }],
  category: { id: "c", slug: "actual-category", name: "Actual category" },
  seller: { id: "s", userId: "u", displayName: "Real store" },
};
function production() {
  vi.stubEnv("EAZICART_SITE_URL", "https://verified.example.test");
  vi.stubEnv("EAZICART_INDEXING", "true");
  vi.stubEnv("EAZICART_CATALOG_INDEXING", "true");
  vi.stubEnv("VERCEL_ENV", "production");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("indexability boundaries", () => {
  it("does not invent a production origin or index an unconfigured deployment", () => {
    vi.stubEnv("EAZICART_SITE_URL", "");
    expect(siteOrigin()).toBeUndefined();
    expect(canonicalUrl("/landing")).toBeUndefined();
    expect(publicIndexingEnabled()).toBe(false);
  });
  it.each([
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test?key=secret",
  ])("rejects invalid canonical origins: %s", (url) => {
    vi.stubEnv("EAZICART_SITE_URL", url);
    expect(siteOrigin()).toBeUndefined();
  });
  it("prevents preview indexing even with inherited production flags", () => {
    production();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(publicIndexingEnabled()).toBe(false);
    expect(catalogIndexingEnabled()).toBe(false);
  });
  it("keeps utility pages noindex and strips query filters from canonical paths supplied by routes", () => {
    production();
    expect(
      pageMetadata("Cart", "Your cart", "/cart", { index: false }).robots,
    ).toEqual({ index: false, follow: true });
    expect(
      pageMetadata("Product", "A product", "/product/actual-product", {
        catalog: true,
      }).alternates,
    ).toEqual({
      canonical: "https://verified.example.test/product/actual-product",
    });
  });
});
describe("truthful public data and errors", () => {
  it("uses actual offer stock/price and never invents ratings", () => {
    production();
    const schema = productSchema(product);
    expect(schema?.offers?.price).toBe("2500.00");
    expect(schema?.offers?.availability).toBe("https://schema.org/OutOfStock");
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(
      productSchema({ ...product, price: "invalid" })?.offers,
    ).toBeUndefined();
  });
  it("escapes script closing tags in untrusted catalog text", () => {
    expect(jsonLd({ name: "</script><script>bad()</script>" })).not.toContain(
      "</script>",
    );
  });
  it("excludes unapproved seller/user fields from SSR payloads", () => {
    const row = {
      ...product,
      supplierSecret: "private",
      seller: {
        ...product.seller,
        email: "private",
        user: { id: "u", name: "Private personal name" },
      },
    };
    const data = publicProduct(row);
    expect(data).not.toHaveProperty("supplierSecret");
    expect(data.seller).not.toHaveProperty("email");
    expect(data.seller).not.toHaveProperty("user");
  });
  it("distinguishes genuine missing content from API outage", async () => {
    vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 503 })),
    );
    expect((await getPublicProduct("missing")).status).toBe("missing");
    expect((await getPublicProduct("outage")).status).toBe("unavailable");
  });
  it("returns 503 for sitemap API outages rather than publishing an empty catalog", async () => {
    production();
    vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await indexGET()).status).toBe(503);
    expect(
      (
        await catalogGET(
          new Request("https://verified.example.test/catalog-sitemap/1.xml"),
          { params: Promise.resolve({ page: "1.xml" }) },
        )
      ).status,
    ).toBe(503);
  });
  it("excludes private URLs and splits real catalog pages without inventing records", async () => {
    production();
    vi.stubEnv("EAZICART_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          Response.json({
            data: [product],
            pagination: { page: 1, limit: 100, total: 101, pages: 2 },
          }),
        ),
      ),
    );
    const index = await (await indexGET()).text();
    expect(index).toContain("/catalog-sitemap/2.xml");
    expect(index).not.toContain("/checkout");
    const catalog = await (
      await catalogGET(
        new Request("https://verified.example.test/catalog-sitemap/1.xml"),
        { params: Promise.resolve({ page: "1.xml" }) },
      )
    ).text();
    expect(catalog).toContain("/product/actual-product");
    expect(catalog).toContain("/seller/s");
    expect(catalog).not.toContain("/login");
  });
});
