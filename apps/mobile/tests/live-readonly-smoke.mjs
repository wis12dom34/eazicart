import assert from "node:assert/strict";
const base = (
  process.env.EXPO_PUBLIC_EAZICART_API_BASE_URL ?? "https://eazicart.com/api"
).replace(/\/$/, "");
async function get(path) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200, `GET ${path} returned ${response.status}`);
  return response.json();
}
const health = await get("/health");
assert.equal(health.status, "ok");
const feed = await get("/feed/products?limit=2");
assert.ok(Array.isArray(feed.data));
assert.ok(typeof feed.pagination?.hasMore === "boolean");
if (feed.data.length) {
  const featured = feed.data[0];
  assert.ok(
    typeof featured.id === "string" && typeof featured.price === "string",
  );
  assert.ok(Array.isArray(featured.images));
  const product = await get("/products/" + encodeURIComponent(featured.id));
  assert.equal(product.data.id, featured.id);
  const comments = await get(
    "/products/" + encodeURIComponent(featured.id) + "/comments?limit=1",
  );
  assert.ok(Array.isArray(comments.data));
  const seller = await get(
    "/sellers/" + encodeURIComponent(featured.seller.id),
  );
  assert.equal(seller.data.id, featured.seller.id);
  const sellerProducts = await get(
    "/sellers/" + encodeURIComponent(featured.seller.id) + "/products",
  );
  assert.ok(Array.isArray(sellerProducts.data));
}
if (feed.data.length) {
  const sellerUid = feed.data[0]?.seller?.userId;
  if (sellerUid) {
    const previews = await get(
      "/social/stories?userIds=" + encodeURIComponent(sellerUid),
    );
    assert.ok(previews.data && typeof previews.data === "object");
    const list = await get("/social/stories/" + encodeURIComponent(sellerUid));
    assert.ok(Array.isArray(list.data));
  }
}
const search = await get("/products?limit=2&page=1");
assert.ok(Array.isArray(search.data));
console.log("PASS: EaziCart production read-only API contract smoke checks");
