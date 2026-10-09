const API_BASE_URL = (
  process.env.NODE_ENV === "production"
    ? "/api"
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001")
).replace(/\/$/, "");
const TOKEN_KEY = "eazicart.auth.tokens";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

type AccessSession = {
  accessToken: string;
  expiresAt: string;
};
type SessionTokens = AccessSession & { refreshToken?: string };
let memoryTokens: AccessSession | null = null;

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
  rawBody?: Blob;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
  retry?: boolean;
  timeoutMs?: number;
};
let refreshPromise: Promise<boolean> | null = null;

const legacyStorage = () =>
  typeof window !== "undefined" && typeof localStorage !== "undefined"
    ? localStorage
    : null;

function readLegacyTokens(): SessionTokens | null {
  const storage = legacyStorage();
  if (!storage) return null;
  const raw = storage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionTokens>;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

export const getLegacyRefreshToken = () => readLegacyTokens()?.refreshToken;

export const tokenStore = {
  get: () => memoryTokens,
  set: (tokens: SessionTokens) => {
    memoryTokens = {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    };
    // New sessions never persist refresh credentials in browser storage.
    legacyStorage()?.removeItem(TOKEN_KEY);
  },
  clear: () => {
    memoryTokens = null;
    legacyStorage()?.removeItem(TOKEN_KEY);
  },
};

function apiUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const target = `${API_BASE_URL}${suffix}`;
  if (/^https?:\/\//i.test(target)) return new URL(target);
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:3000";
  return new URL(target, origin);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (externalSignal?.aborted) abortFromCaller();
  else
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(input, {
      ...init,
      credentials: init.credentials ?? "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        408,
        "REQUEST_TIMEOUT",
        "The server took too long to respond. Check your connection and try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Unable to reach EaziCart. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function refresh(): Promise<boolean> {
  const legacyRefreshToken = getLegacyRefreshToken();
  try {
    const response = await fetchWithTimeout(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: legacyRefreshToken
        ? { "Content-Type": "application/json" }
        : undefined,
      body: legacyRefreshToken
        ? JSON.stringify({ refreshToken: legacyRefreshToken })
        : undefined,
    });
    if (!response.ok) {
      tokenStore.clear();
      return false;
    }
    const payload = (await response.json()) as { tokens: SessionTokens };
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
    rawBody,
    auth = false,
    retry = true,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    headers: customHeaders,
    ...init
  } = options;
  const url = apiUrl(path);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  });
  const headers = new Headers(customHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const accessToken = tokenStore.get()?.accessToken;
  if (auth && accessToken)
    headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    },
    timeoutMs,
  );
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
