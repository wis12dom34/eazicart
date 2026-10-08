import { apiRequest } from "./client";

export type ConversationMessage = {
  id: string;
  body: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string };
};

export type Conversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  buyer: { id: string; name: string };
  seller: {
    id: string;
    displayName: string;
    user: { id: string; name: string };
  };
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

export const conversationsApi = {
  list: () =>
    apiRequest<{ data: Conversation[] }>("/conversations", { auth: true }),
  start: (sellerId: string) =>
    apiRequest<{ data: Conversation }>("/conversations", {
      method: "POST",
      auth: true,
      body: { sellerId },
    }),
  messages: (id: string) =>
    apiRequest<{ data: ConversationMessage[] }>(
      `/conversations/${encodeURIComponent(id)}/messages`,
      { auth: true },
    ),
  send: (id: string, body: string) =>
    apiRequest<{ data: ConversationMessage }>(
      `/conversations/${encodeURIComponent(id)}/messages`,
      { method: "POST", auth: true, body: { body } },
    ),
};
