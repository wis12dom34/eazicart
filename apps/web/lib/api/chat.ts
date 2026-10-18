import { apiRequest } from "./client";
export type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  readAt: string | null;
};
export type ChatConversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  lastMessageAt: string | null;
  buyer: { id: string; name: string };
  seller: { id: string; userId: string; displayName: string };
  lastMessage?: ChatMessage | null;
  unreadCount?: number;
};
export type ChatPage<T> = {
  data: T[];
  pagination: { hasMore: boolean; nextCursor: string | null };
};
const base = "/chat/conversations";
const path = (id: string) => base + "/" + encodeURIComponent(id);
export const chatApi = {
  list: (cursor?: string) =>
    apiRequest<ChatPage<ChatConversation>>(base, {
      auth: true,
      query: { cursor },
    }),
  open: (sellerId: string) =>
    apiRequest<{ data: ChatConversation }>(base, {
      method: "POST",
      auth: true,
      body: { sellerId },
    }),
  get: (id: string) =>
    apiRequest<{ data: ChatConversation }>(path(id), { auth: true }),
  messages: (id: string, cursor?: string) =>
    apiRequest<ChatPage<ChatMessage>>(path(id) + "/messages", {
      auth: true,
      query: { cursor },
    }),
  send: (id: string, body: string, idempotencyKey: string) =>
    apiRequest<{ data: ChatMessage }>(path(id) + "/messages", {
      method: "POST",
      auth: true,
      body: { body, idempotencyKey },
    }),
  read: (id: string, messageIds: string[]) =>
    apiRequest<{ data: { updated: number } }>(path(id) + "/read", {
      method: "POST",
      auth: true,
      body: { messageIds },
    }),
};
export function mergeChatMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
) {
  const rows = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    const old = rows.get(row.id);
    rows.set(row.id, { ...row, readAt: row.readAt ?? old?.readAt ?? null });
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]