const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");
const TOKEN_KEY = "eazicart.auth.tokens";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
  retry?: boolean;
};
let refreshPromise: Promise<boolean> | null = null;

export const tokenStore = {
  get: () => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(TOKEN_KEY);
    try {
      return raw
        ? (JSON.parse(raw) as {
            accessToken: string;
            refreshToken: string;
            expiresAt: string;
          })
        : null;
    } catch {
      return null;
    }
  },
  set: (tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }) => {
    if (typeof window !== "undefined")
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },
  clear: () => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};

async function refresh(): Promise<boolean> {
  const token = tokenStore.get()?.refreshToken;
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!response.ok) {
      tokenStore.clear();
      return false;
    }
    const payload = (await response.json()) as {
      tokens: { accessToken: string; refreshToken: string; expiresAt: string };
    };
    tokenStore.set(payload.tokens);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    query,
    body,
    auth = false,
    retry = true,
    headers: customHeaders,
    ...init
  } = options;
  const url = new URL(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  });
  const headers = new Headers(customHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const accessToken = tokenStore.get()?.accessToken;
  if (auth && accessToken)
    headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && auth && retry) {
    refreshPromise ??= refresh().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise)
      return apiRequest<T>(path, { ...options, retry: false });
  }
  if (!response.ok) {
    let payload: {
      error?: { code?: string; message?: string; details?: unknown };
    } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      /* non-JSON upstream response */
    }
    throw new ApiError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? `Request failed (${response.status})`,
      payload.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
