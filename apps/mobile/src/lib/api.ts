import { resolveMobileApiBaseUrl } from "./api-base";
import type {
  AuthResponse,
  CommentPage,
  FeedPage,
  ProductPage,
  ProductSearchPage,
  SavedItem,
  Seller,
  Product,
  ReelCommentsPage,
  ReelsPage,
  StoryPreviewResponse,
  StoryListResponse,
  FollowingResponse,
  FollowerCountResponse,
  Cart,
  Address,
  AddressInput,
  OrderSummary,
  Notification,
  NotificationListResponse,
  Conversation,
  ChatPage,
  ChatMessage,
} from "./types";

const configuredUrlFromEnv: unknown =
  process.env.EXPO_PUBLIC_EAZICART_API_BASE_URL;
const configuredUrl =
  typeof configuredUrlFromEnv === "string" ? configuredUrlFromEnv : undefined;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
export function setAccessToken(value: string | null) {
  accessToken = value;
}
export function setRefreshHandler(handler: (() => Promise<boolean>) | null) {
  refreshHandler = handler;
}
export function currentAccessToken() {
  return accessToken;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: "required" | "optional" | "none";
  signal?: AbortSignal;
  retryAuth?: boolean;
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = "none",
    signal,
    retryAuth = true,
  } = options;
  if (auth === "required" && !accessToken)
    throw new ApiError(401, "LOGIN_REQUIRED", "Sign in to continue");
  const baseUrl = resolveMobileApiBaseUrl(configuredUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth !== "none" && accessToken)
    headers.Authorization = `Bearer ${accessToken}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", cancel, { once: true });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new ApiError(408, "TIMEOUT", "The request timed out. Try again.");
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Cannot reach EaziCart. Check your internet connection.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
  if (
    response.status === 401 &&
    retryAuth &&
    auth !== "none" &&
    refreshHandler
  ) {
    if (await refreshHandler())
      return request<T>(path, { ...options, retryAuth: false });
  }
  if (!response.ok) {
    let error: { error?: { code?: string; message?: string } } = {};
    try {
      error = (await response.json()) as typeof error;
    } catch {
      /* Non-JSON response */
    }
    throw new ApiError(
      response.status,
      error.error?.code ?? "REQUEST_FAILED",
      error.error?.message ?? "Request failed",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

const qs = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
};

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    }),
  session: (refreshToken: string) =>
    request<AuthResponse>("/auth/session", {
      method: "POST",
      body: { refreshToken },
    }),
  logout: (refreshToken: string) =>
    request<void>("/auth/logout", { method: "POST", body: { refreshToken } }),
  feed: (cursor?: string | null, signedIn = false) =>
    request<FeedPage>(
      `/feed/products?${qs({ limit: 18, cursor: cursor ?? undefined })}`,
      { auth: signedIn ? "optional" : "none" },
    ),
  product: (id: string) =>
    request<ProductPage>(`/products/${encodeURIComponent(id)}`),
  search: (search: string, page = 1) =>
    request<ProductSearchPage>(`/products?${qs({ search, page, limit: 21 })}`),
  seller: (id: string) =>
    request<{ data: Seller }>(`/sellers/${encodeURIComponent(id)}`),
  sellerProducts: (id: string) =>
    request<{ data: Product[] }>(`/sellers/${encodeURIComponent(id)}/products`),
  following: () =>
    request<FollowingResponse>("/following", { auth: "required" }),
  followSeller: (sellerUserId: string) =>
    request<unknown>(`/sellers/${encodeURIComponent(sellerUserId)}/follow`, {
      method: "POST",
      auth: "required",
    }),
  unfollowSeller: (sellerUserId: string) =>
    request<void>(`/sellers/${encodeURIComponent(sellerUserId)}/follow`, {
      method: "DELETE",
      auth: "required",
    }),
  followerCount: (sellerUserId: string) =>
    request<FollowerCountResponse>(
      `/sellers/${encodeURIComponent(sellerUserId)}/followers/count`,
    ),
  cart: () => request<{ data: Cart }>("/cart", { auth: "required" }),
  cartAdd: (productId: string, quantity: number) =>
    request<{ data: Cart }>("/cart/items", {
      auth: "required",
      method: "POST",
      body: { productId, quantity },
    }),
  cartUpdate: (itemId: string, quantity: number) =>
    request<{ data: Cart }>(`/cart/items/${encodeURIComponent(itemId)}`, {
      auth: "required",
      method: "PATCH",
      body: { quantity },
    }),
  cartRemove: (itemId: string) =>
    request<void>(`/cart/items/${encodeURIComponent(itemId)}`, {
      auth: "required",
      method: "DELETE",
    }),
  cartClear: () =>
    request<void>("/cart", { auth: "required", method: "DELETE" }),
  addresses: () =>
    request<{ data: Address[] }>("/addresses", { auth: "required" }),
  createAddress: (address: AddressInput) =>
    request<{ data: Address }>("/addresses", {
      auth: "required",
      method: "POST",
      body: address,
    }),
  deleteAddress: (id: string) =>
    request<void>(`/addresses/${encodeURIComponent(id)}`, {
      auth: "required",
      method: "DELETE",
    }),
  orders: () =>
    request<{ data: OrderSummary[] }>("/orders", { auth: "required" }),
  saved: () =>
    request<{ data: SavedItem[] }>("/saved-products", { auth: "required" }),
  save: (id: string) =>
    request<void>(`/saved-products/${encodeURIComponent(id)}`, {
      method: "POST",
      auth: "required",
    }),
  unsave: (id: string) =>
    request<void>(`/saved-products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: "required",
    }),
  like: (id: string) =>
    request<{ data: NonNullable<FeedPage["data"][number]["social"]> }>(
      `/products/${encodeURIComponent(id)}/like`,
      { method: "POST", auth: "required" },
    ),
  unlike: (id: string) =>
    request<{ data: NonNullable<FeedPage["data"][number]["social"]> }>(
      `/products/${encodeURIComponent(id)}/like`,
      { method: "DELETE", auth: "required" },
    ),
  comments: (id: string, cursor?: string | null) =>
    request<CommentPage>(
      `/products/${encodeURIComponent(id)}/comments?${qs({ cursor: cursor ?? undefined, limit: 20 })}`,
    ),

  reelsFeed: (cursor?: string | null, signedIn = false) =>
    request<ReelsPage>(
      `/reels/feed?${qs({ limit: 8, cursor: cursor ?? undefined })}`,
      { auth: signedIn ? "optional" : "none" },
    ),
  reelInteractions: (id: string) =>
    request<{ data: { liked: boolean; saved: boolean } }>(
      `/reels/${encodeURIComponent(id)}/interactions`,
      { auth: "required" },
    ),
  reelLike: (id: string, liked: boolean) =>
    request<{ data: { liked: boolean; count: number } }>(
      `/reels/${encodeURIComponent(id)}/like`,
      { method: liked ? "DELETE" : "POST", auth: "required" },
    ),
  reelSave: (id: string, saved: boolean) =>
    request<{ data: { saved: boolean; count: number } }>(
      `/reels/${encodeURIComponent(id)}/save`,
      { method: saved ? "DELETE" : "POST", auth: "required" },
    ),
  reelComments: (id: string, cursor?: string | null) =>
    request<ReelCommentsPage>(
      `/reels/${encodeURIComponent(id)}/comments?${qs({ limit: 20, cursor: cursor ?? undefined })}`,
    ),
  reelComment: (id: string, body: string) =>
    request<{ data: { id: string } }>(
      `/reels/${encodeURIComponent(id)}/comments`,
      { method: "POST", auth: "required", body: { body } },
    ),
  reelView: (
    id: string,
    watchMs: number,
    completed: boolean,
    idempotencyKey: string,
  ) =>
    request<{ data: { id: string } }>(
      `/reels/${encodeURIComponent(id)}/views`,
      {
        method: "POST",
        auth: "required",
        body: { watchMs, completed, idempotencyKey },
      },
    ),
  storyPreviews: (userIds: string[]) => {
    const ids = [...new Set(userIds.filter(Boolean))].slice(0, 12);
    return request<StoryPreviewResponse>(
      `/social/stories?${qs({ userIds: ids.join(",") })}`,
    );
  },
  storiesForUser: (userId: string) =>
    request<StoryListResponse>(`/social/stories/${encodeURIComponent(userId)}`),
  conversations: () =>
    request<{ data: Conversation[]; meta: { unreadCount: number } }>(
      "/conversations",
      { auth: "required" },
    ),
  startConversation: (sellerUserId: string) =>
    request<{ data: Conversation }>("/conversations", {
      auth: "required",
      method: "POST",
      body: { sellerUserId },
    }),
  conversationMessages: (id: string, cursor?: string | null) =>
    request<ChatPage>(
      `/conversations/${encodeURIComponent(id)}/messages?${qs({ cursor: cursor ?? undefined })}`,
      { auth: "required" },
    ),
  conversationBlock: (id: string, blocked: boolean) =>
    request<{ data: { blocked: boolean } }>(
      `/conversations/${encodeURIComponent(id)}/block`,
      { method: "PATCH", auth: "required", body: { blocked } },
    ),
  conversationRead: (id: string) =>
    request<{ data: { read: boolean } }>(
      `/conversations/${encodeURIComponent(id)}/read`,
      { auth: "required", method: "PATCH" },
    ),
  sendChatMessage: (
    id: string,
    body: string,
    clientMessageId: string,
    productId?: string,
  ) =>
    request<{ data: ChatMessage }>(
      `/conversations/${encodeURIComponent(id)}/messages`,
      {
        method: "POST",
        auth: "required",
        body: { body, clientMessageId, ...(productId ? { productId } : {}) },
      },
    ),
  notifications: () =>
    request<NotificationListResponse>("/notifications", { auth: "required" }),
  notificationRead: (id: string) =>
    request<{ data: Notification }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH", auth: "required" },
    ),
  notificationsReadAll: () =>
    request<{ data: { updated: number } }>("/notifications/read-all", {
      method: "PATCH",
      auth: "required",
    }),
  comment: (id: string, body: string) =>
    request<unknown>(`/products/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: { body },
      auth: "required",
    }),
};
