import { apiRequest } from "./client";
import type { AuthResponse, Tokens } from "./types";
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (name: string, email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    }),
  refresh: (refreshToken?: string) =>
    apiRequest<{ tokens: Tokens }>("/auth/refresh", {
      method: "POST",
      body: refreshToken ? { refreshToken } : undefined,
    }),
  logout: (refreshToken?: string) =>
    apiRequest<void>("/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
    }),
};

export const browserAccountsEnabled =
  process.env.NEXT_PUBLIC_BROWSER_ACCOUNTS_ENABLED === "1";

type BrowserSession = {
  user: import("./types").User;
  tokens: { accessToken: string; expiresAt: string };
};

function browserAction<T>(action: string, body?: unknown) {
  return apiRequest<T>(`/auth/browser/${action}`, { method: "POST", body });
}

export const browserAuth = {
  device: () => browserAction<{ activeUserId: string | null }>("device"),
  session: () => browserAction<BrowserSession>("session"),
  accounts: () =>
    browserAction<{
      activeUserId: string | null;
      accounts: import("./types").User[];
    }>("accounts"),
  add: (email: string, password: string) =>
    browserAction<BrowserSession>("add", { email, password }),
  switch: (userId: string) =>
    browserAction<BrowserSession>("switch", { userId }),
  remove: (userId: string) => browserAction("remove", { userId }),
  logoutAll: () => browserAction("logout-all"),
};

export function enrollBrowserAccount(email: string, password: string) {
  const enroll = async () => {
    await browserAuth.device();
    return browserAuth.add(email, password);
  };
  return navigator.locks
    ? navigator.locks.request("eazicart-browser-enrollment", enroll)
    : enroll();
}
