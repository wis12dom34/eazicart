import type {
  AuthResponse,
  CommentPage,
  FeedPage,
  ProductPage,
  ProductSearchPage,
  SavedItem,
  Seller,
  Product,
} from "./types";

const configuredUrl: string =
  (process.env.EXPO_PUBLIC_EAZICART_API_BASE_URL as string | undefined) ??
  "https://eazicart.com/api";
const BASE_URL = configuredUrl.replace(/\/$/, "");
if (
  !/^https:\/\//.test(BASE_URL) &&
  !/^http:\/\/localhost(?::\d+)?(?:\/|$)/.test(BASE_URL)
) {
  throw new Error(
    "API URL must use HTTPS (or localhost for local development)",
  );
}

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
    response = await fetch(`${BASE_URL}${path}`, {
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
  comment: (id: string, body: string) =>
    request<unknown>(`/products/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: { body },
      auth: "required",
    }),
};
