import { apiRequest } from "./client";
export type ProductSocial = { likes: number; comments: number; liked: boolean };
export type ProductComment = {
  id: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "gif" | null;
  parentId?: string | null;
  parent?: { id: string; user: { id: string; name: string } } | null;
  replyCount?: number;
  likeCount: number;
  liked: boolean;
  userId: string;
  productId: string;
  createdAt: string;
  user: { id: string; name: string };
};
export type ProductCommentsPage = {
  data: ProductComment[];
  pagination: { hasMore: boolean; nextCursor: string | null };
};
const path = (id: string) => `/products/${encodeURIComponent(id)}`;
export const productSocialApi = {
  get: (id: string, authenticated: boolean) =>
    apiRequest<{ data: ProductSocial }>(path(id) + "/social", {
      auth: authenticated,
    }),
  like: (id: string, liked: boolean) =>
    apiRequest<{ data: ProductSocial }>(path(id) + "/like", {
      method: liked ? "POST" : "DELETE",
      auth: true,
    }),
  comments: (id: string, cursor?: string, authenticated = false) =>
    apiRequest<ProductCommentsPage>(path(id) + "/comments", { auth: authenticated, query: { cursor } }),
  commentLike: (id: string, commentId: string, liked: boolean) =>
    apiRequest<{ data: { liked: boolean; likeCount: number } }>(path(id) + "/comments/" + encodeURIComponent(commentId) + "/like", { method: liked ? "POST" : "DELETE", auth: true }),
  comment: (id: string, body: string, idempotencyKey: string, media?: { url: string; type: "image" | "gif" }, parentId?: string) =>
    apiRequest<{ data: ProductComment }>(path(id) + "/comments", {
      method: "POST",
      auth: true,
      body: { body, idempotencyKey, mediaUrl: media?.url, mediaType: media?.type, parentId },
    }),
  removeComment: (id: string, commentId: string) =>
    apiRequest<void>(path(id) + "/comments/" + encodeURIComponent(commentId), {
      method: "DELETE",
      auth: true,
    }),
};

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]