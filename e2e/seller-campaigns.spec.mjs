import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = process.env.E2E_API_BASE ?? "http://localhost:3001";

async function register(request, name) {
  const response = await request.post(`${api}/auth/register`, {
    data: {
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`,
      name,
      password: `campaign-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).tokens.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

async function createSeller(request, token, displayName) {
  const response = await request.post(`${api}/seller-profile`, {
    headers: headers(token),
    data: { displayName },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function createProduct(request, token, name) {
  const response = await request.post(`${api}/products`, {
    headers: headers(token),
    data: {
      name,
      price: "12500",
      stock: 20,
      categoryId: "demo-category-fashion",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

test("seller campaign drafts are owned, validated and do not invent delivery metrics", async ({
  request,
}) => {
  const unauthenticated = await request.get(`${api}/seller/campaigns`);
  expect(unauthenticated.status()).toBe(401);

  const sellerToken = await register(request, "Campaign Seller");
  const beforeProfile = await request.get(`${api}/seller/campaigns`, {
    headers: headers(sellerToken),
  });
  expect(beforeProfile.status()).toBe(403);
  expect((await beforeProfile.json()).error.code).toBe("SELLER_REQUIRED");

  await createSeller(request, sellerToken, "Campaign Seller Store");
  const product = await createProduct(
    request,
    sellerToken,
    "Campaign foundation product",
  );

  const otherToken = await register(request, "Other Campaign Seller");
  await createSeller(request, otherToken, "Other Campaign Store");
  const otherProduct = await createProduct(
    request,
    otherToken,
    "Other seller product",
  );

  const wrongOwner = await request.post(`${api}/seller/campaigns`, {
    headers: headers(sellerToken),
    data: {
      productId: otherProduct.id,
      objective: "PRODUCT_VIEWS",
      dailyBudget: "5000",
      durationDays: 7,
    },
  });
  expect(wrongOwner.status()).toBe(404);
  expect((await wrongOwner.json()).error.code).toBe("PRODUCT_NOT_FOUND");

  const created = await request.post(`${api}/seller/campaigns`, {
    headers: headers(sellerToken),
    data: {
      productId: product.id,
      objective: "PRODUCT_VIEWS",
      audienceCountry: "Nigeria",
      audienceAgeMin: 18,
      audienceAgeMax: 44,
      audienceInterests: "Shopping interests",
      dailyBudget: "5000",
      durationDays: 7,
    },
  });
  expect(created.status()).toBe(201);
  const campaign = (await created.json()).data;
  expect(campaign).toEqual(
    expect.objectContaining({
      name: "Campaign foundation product Campaign",
      objective: "PRODUCT_VIEWS",
      status: "DRAFT",
      audienceCountry: "Nigeria",
      audienceAgeMin: 18,
      audienceAgeMax: 44,
      audienceInterests: "Shopping interests",
      dailyBudget: "5000",
      totalBudget: "35000",
      durationDays: 7,
      delivery: {
        enabled: false,
        reason: "Campaign delivery is not configured yet.",
      },
      metrics: {
        spend: null,
        revenue: null,
        impressions: null,
        productVisits: null,
        orders: null,
        conversionRate: null,
        roas: null,
      },
    }),
  );
  expect(campaign.product).toEqual(
    expect.objectContaining({
      id: product.id,
      name: "Campaign foundation product",
      price: "12500",
    }),
  );

  const invalidPartialAge = await request.patch(
    `${api}/seller/campaigns/${campaign.id}`,
    {
      headers: headers(sellerToken),
      data: { audienceAgeMin: 45 },
    },
  );
  expect(invalidPartialAge.status()).toBe(400);
  expect((await invalidPartialAge.json()).error.code).toBe(
    "INVALID_AUDIENCE_AGE_RANGE",
  );

  const updated = await request.patch(
    `${api}/seller/campaigns/${campaign.id}`,
    {
      headers: headers(sellerToken),
      data: { durationDays: 14, objective: "ORDERS" },
    },
  );
  expect(updated.status()).toBe(200);
  expect((await updated.json()).data).toEqual(
    expect.objectContaining({
      objective: "ORDERS",
      durationDays: 14,
      dailyBudget: "5000",
      totalBudget: "70000",
      status: "DRAFT",
    }),
  );

  const list = await request.get(`${api}/seller/campaigns`, {
    headers: headers(sellerToken),
  });
  expect(list.status()).toBe(200);
  const listBody = await list.json();
  expect(listBody.delivery.enabled).toBe(false);
  expect(listBody.data).toHaveLength(1);
  expect(listBody.data[0].id).toBe(campaign.id);

  const otherSellerRead = await request.get(
    `${api}/seller/campaigns/${campaign.id}`,
    { headers: headers(otherToken) },
  );
  expect(otherSellerRead.status()).toBe(404);

  const removed = await request.delete(
    `${api}/seller/campaigns/${campaign.id}`,
    { headers: headers(sellerToken) },
  );
  expect(removed.status()).toBe(204);

  const afterDelete = await request.get(`${api}/seller/campaigns`, {
    headers: headers(sellerToken),
  });
  expect((await afterDelete.json()).data).toEqual([]);
});
