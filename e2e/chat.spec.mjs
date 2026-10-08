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

test("customer and seller can exchange messages in one protected conversation", async ({
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

  await page.goto(`/seller/${seller.id}`);
  await page.getByRole("button", { name: "Message", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${web}/chat/.+`));

  await page.getByLabel("Message Chat Store").fill("Hi, is this available?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Hi, is this available?", { exact: true })).toBeVisible();

  const conversationId = new URL(page.url()).pathname.split("/").at(-1);
  expect(conversationId).toBeTruthy();

  const sellerConversations = await request.get(`${api}/conversations`, {
    headers: headers(sellerAccount.token),
  });
  expect(sellerConversations.status()).toBe(200);
  expect((await sellerConversations.json()).data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: conversationId, sellerId: seller.id }),
    ]),
  );

  const reply = await request.post(
    `${api}/conversations/${conversationId}/messages`,
    {
      headers: headers(sellerAccount.token),
      data: { body: "Yes, it is available." },
    },
  );
  expect(reply.status()).toBe(201);

  await page.reload();
  await expect(page.getByText("Yes, it is available.", { exact: true })).toBeVisible();

  const stranger = await register(request, "Chat Stranger");
  const blocked = await request.get(
    `${api}/conversations/${conversationId}/messages`,
    { headers: headers(stranger.token) },
  );
  expect(blocked.status()).toBe(404);
});
