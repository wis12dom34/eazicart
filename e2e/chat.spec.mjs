import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const web = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3000";
const api = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

async function register(request, name) {
  const email = `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@eazicart.invalid`;
  const password = `chat-${randomUUID()}`;
  const response = await request.post(`${api}/auth/register`, {
    data: { name, email, password },
  });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  return { email, password, token: payload.tokens.accessToken };
}

const headers = (token) => ({ authorization: `Bearer ${token}` });

test("customer and seller can exchange messages with protected unread state", async ({
  page,
  request,
}) => {
  const sellerAccount = await register(request, "Chat Seller");
  const sellerProfileResponse = await request.post(`${api}/seller-profile`, {
    headers: headers(sellerAccount.token),
    data: { displayName: "Chat Store", bio: "Seller available for questions" },
  });
  expect(sellerProfileResponse.status()).toBe(201);
  const seller = (await sellerProfileResponse.json()).data;

  const buyerEmail = `chat-buyer-${randomUUID()}@eazicart.invalid`;
  const buyerPassword = `chat-buyer-${randomUUID()}`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Chat Buyer");
  await page.getByLabel("Email address").fill(buyerEmail);
  await page.getByLabel("Password", { exact: true }).fill(buyerPassword);
  await page.getByLabel("Confirm password").fill(buyerPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${web}/`);

  const buyerToken = await page.evaluate(() => {
    const stored = localStorage.getItem("eazicart.auth.tokens");
    if (!stored) throw new Error("Missing buyer auth tokens");
    return JSON.parse(stored).accessToken;
  });
  const starts = await Promise.all([
    request.post(`${api}/conversations`, {
      headers: headers(buyerToken),
      data: { sellerId: seller.id },
    }),
    request.post(`${api}/conversations`, {
      headers: headers(buyerToken),
      data: { sellerId: seller.id },
    }),
  ]);
  expect(starts.map((response) => response.status()).sort()).toEqual([
    200, 201,
  ]);
  const started = await Promise.all(starts.map((response) => response.json()));
  const conversationId = started[0].data.id;
  expect(started[1].data.id).toBe(conversationId);

  await page.goto(`/seller/${seller.id}`);
  await page.getByRole("button", { name: "Message", exact: true }).click();
  await expect(page).toHaveURL(`${web}/chat/${conversationId}`);

  await page.getByLabel("Message Chat Store").fill("Hi, is this available?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Hi, is this available?", { exact: true }),
  ).toBeVisible();

  const sellerConversations = await request.get(`${api}/conversations`, {
    headers: headers(sellerAccount.token),
  });
  expect(sellerConversations.status()).toBe(200);
  expect((await sellerConversations.json()).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: conversationId,
        sellerId: seller.id,
        sellerUnreadCount: 1,
      }),
    ]),
  );

  const sellerRead = await request.get(
    `${api}/conversations/${conversationId}/messages`,
    { headers: headers(sellerAccount.token) },
  );
  expect(sellerRead.status()).toBe(200);
  const sellerAfterRead = await request.get(`${api}/conversations`, {
    headers: headers(sellerAccount.token),
  });
  expect((await sellerAfterRead.json()).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: conversationId,
        sellerUnreadCount: 0,
      }),
    ]),
  );

  await page.goto("/chat");
  const reply = await request.post(
    `${api}/conversations/${conversationId}/messages`,
    {
      headers: headers(sellerAccount.token),
      data: { body: "Yes, it is available." },
    },
  );
  expect(reply.status()).toBe(201);

  const buyerUnread = await request.get(`${api}/conversations`, {
    headers: headers(buyerToken),
  });
  expect((await buyerUnread.json()).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: conversationId,
        buyerUnreadCount: 1,
      }),
    ]),
  );

  await page.reload();
  await expect(page.getByLabel("1 unread message")).toBeVisible();
  await expect(
    page.getByText("Yes, it is available.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link")
    .filter({ hasText: "Chat Store" })
    .first()
    .click();
  await expect(page).toHaveURL(`${web}/chat/${conversationId}`);
  await expect(
    page.getByText("Yes, it is available.", { exact: true }),
  ).toBeVisible();

  const buyerAfterRead = await request.get(`${api}/conversations`, {
    headers: headers(buyerToken),
  });
  expect((await buyerAfterRead.json()).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: conversationId,
        buyerUnreadCount: 0,
      }),
    ]),
  );

  const stranger = await register(request, "Chat Stranger");
  const blocked = await request.get(
    `${api}/conversations/${conversationId}/messages`,
    { headers: headers(stranger.token) },
  );
  expect(blocked.status()).toBe(404);
});
