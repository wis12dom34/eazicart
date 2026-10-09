import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Test-only fixtures; never written to a database or deployed as a catalog.
const seller = {
  id: "qa-store",
  userId: "qa-follow-id",
  displayName: "QA Store",
  bio: "Test-only catalog",
  followerCount: 0,
  _count: { products: 1 },
  user: { id: "private", name: "PRIVATE-USER-MARKER" },
};
const category = {
  id: "qa-category",
  slug: "qa-category",
  name: "QA Category",
  _count: { products: 1 },
};
const product = {
  id: "qa-product",
  name: "QA Catalog Product",
  description: "Server-rendered test-only product description",
  price: "1250.00",
  stock: 3,
  active: true,
  category,
  seller,
  images: [],
  supplierSecret: "PRIVATE-SUPPLIER-MARKER",
};
const api = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("Content-Type", "application/json");
  const send = (value, status = 200) => {
    response.statusCode = status;
    response.end(JSON.stringify(value));
  };
  if (url.pathname === "/categories")
    return send({
      data: [
        category,
        { id: "empty", slug: "empty", name: "Empty", _count: { products: 0 } },
      ],
    });
  if (url.pathname === "/products") {
    const page = Number(url.searchParams.get("page") ?? 1);
    const empty = url.searchParams.get("category") === "empty" || page > 1;
    return send({
      data: empty ? [] : [product],
      pagination: {
        page,
        limit: 100,
        total: empty ? 0 : 1,
        pages: empty ? 0 : 1,
      },
    });
  }
  if (url.pathname === "/products/qa-product") return send({ data: product });
  if (url.pathname === "/products/offline")
    return send({ error: "offline" }, 503);
  if (["/sellers/qa-store", "/sellers/qa-follow-id"].includes(url.pathname))
    return send({ data: seller });
  return send({ error: { message: "Not found" } }, 404);
});
api.listen(3006, "127.0.0.1");
await once(api, "listening");

const env = {
  ...process.env,
  EAZICART_SITE_URL: "https://seo.example.test",
  EAZICART_INDEXING: "true",
  EAZICART_CATALOG_INDEXING: "true",
  EAZICART_PUBLIC_API_URL: "http://127.0.0.1:3006",
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3006",
  VERCEL_ENV: "production",
  EAZICART_TEST_DIST_DIR: ".next-seo",
};
let server;
async function run(command, args) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `${command} ${args.join(" ")} failed`);
}
try {
  await run("corepack", ["pnpm", "--filter", "@eazicart/web", "build"]);
  server = spawn(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@eazicart/web",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3005",
    ],
    { env, stdio: "inherit" },
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch("http://127.0.0.1:3005/robots.txt");
      break;
    } catch {
      if (attempt === 99) throw new Error("Local test server did not start");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const routes = [
    "/",
    "/landing",
    "/social-commerce",
    "/online-store",
    "/product/qa-product",
    "/product/missing",
    "/product/offline",
    "/seller/qa-store",
    "/seller/missing",
    "/category/qa-category",
    "/category/empty",
    "/category/missing",
    "/category/qa-category?search=x",
    "/explore?search=x",
    "/login",
    "/register",
    "/cart",
    "/checkout",
    "/seller/dashboard",
    "/seller/store",
    "/orders",
    "/profile",
    "/chat",
    "/reels",
    "/robots.txt",
    "/sitemap.xml",
    "/sitemap-index.xml",
    "/catalog-sitemap/1.xml",
  ];
  const privateRoutes = new Set([
    "/",
    "/explore?search=x",
    "/login",
    "/register",
    "/cart",
    "/checkout",
    "/seller/dashboard",
    "/seller/store",
    "/orders",
    "/profile",
    "/chat",
    "/reels",
  ]);
  for (const route of routes) {
    const response = await fetch(`http://127.0.0.1:3005${route}`);
    const body = await response.text();
    const visible = body.replace(/<script\b[^>]*>.*?<\/script>/gs, "");
    const status = route.endsWith("/missing") ? 404 : 200;
    assert.equal(response.status, status, `${route} status`);
    if (
      privateRoutes.has(route) ||
      [
        "/category/empty",
        "/category/qa-category?search=x",
        "/product/offline",
      ].includes(route)
    )
      assert.match(
        body,
        /name="robots" content="noindex, follow"/,
        `${route} noindex`,
      );
    if (
      [
        "/landing",
        "/social-commerce",
        "/online-store",
        "/product/qa-product",
        "/seller/qa-store",
        "/category/qa-category",
      ].includes(route)
    )
      assert.match(
        body,
        /name="robots" content="index, follow"/,
        `${route} indexable in verified test production`,
      );
    if (route === "/product/qa-product") {
      assert.match(visible, /<h1[^>]*>QA Catalog Product<\/h1>/);
      assert.match(visible, /1,250/);
      assert.match(body, /"price":"1250.00"/);
      assert.match(
        body,
        /rel="canonical" href="https:\/\/seo.example.test\/product\/qa-product"/,
      );
      assert.doesNotMatch(body, /PRIVATE-SUPPLIER-MARKER|PRIVATE-USER-MARKER/);
    }
    if (route === "/seller/qa-store") {
      assert.match(visible, /QA Store/);
      assert.match(visible, /QA Catalog Product/);
      assert.doesNotMatch(body, /PRIVATE-USER-MARKER/);
    }
    if (route === "/category/qa-category")
      assert.match(visible, /QA Catalog Product/);
    if (route === "/product/offline")
      assert.match(visible, /Product details temporarily unavailable/);
    if (route === "/landing") {
      assert.match(visible, /The Operating System for/);
      assert.match(visible, /Questions before you start/);
      assert.match(body, /_next\/image/);
    }
    if (route === "/sitemap.xml") {
      assert.match(body, /\/landing/);
      assert.doesNotMatch(body, /\/checkout|\/category\/empty/);
    }
    if (route === "/catalog-sitemap/1.xml") {
      assert.match(body, /\/product\/qa-product/);
      assert.doesNotMatch(body, /\/login/);
    }
    console.log(`PASS ${response.status} ${route}`);
  }
  const alias = await fetch("http://127.0.0.1:3005/seller/qa-follow-id", {
    redirect: "manual",
  });
  assert.equal(alias.status, 307);
  assert.equal(alias.headers.get("location"), "/seller/qa-store");
  console.log("PASS seller alias redirect; 28 raw-HTML route checks completed");
} finally {
  server?.kill("SIGTERM");
  api.close();
}
