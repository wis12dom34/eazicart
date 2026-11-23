"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  announceAccountChange,
  reloadForAccountChange,
  watchAccountChanges,
} from "../../lib/api/account-change";
import {
  authApi,
  browserAuth,
  browserAccountsEnabled,
  enrollBrowserAccount,
} from "../../lib/api/auth";
import {
  ApiError,
  getLegacyRefreshToken,
  tokenStore,
} from "../../lib/api/client";
import type { AuthResponse, User } from "../../lib/api/types";
import { usersApi } from "../../lib/api/users";

type AuthValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  reloadUser(): Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const reloadUser = useCallback(async () => {
    const me = await usersApi.me();
    setUser(me);
  }, []);
  useEffect(() => {
    if (browserAccountsEnabled) return watchAccountChanges();
  }, []);
  useEffect(() => {
    // HttpOnly refresh cookies cannot be inspected from JavaScript, so ask the
    // API to restore the session. apiRequest performs one refresh-and-retry.
    const restore = async () => {
      if (browserAccountsEnabled) {
        try {
          const session = await browserAuth.session();
          tokenStore.set(session.tokens, true);
          setUser(session.user);
          return;
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            !["DEVICE_SESSION_EXPIRED", "BROWSER_ACCOUNT_EXPIRED"].includes(
              error.code,
            )
          )
            throw error;
        }
      }
      await reloadUser();
    };
    restore()
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [reloadUser]);
  const authenticate = useCallback(async (request: Promise<AuthResponse>) => {
    const result = await request;
    tokenStore.set(result.tokens);
    setUser(result.user);
  }, []);
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: async (email, password) => {
        if (!browserAccountsEnabled)
          return authenticate(authApi.login(email, password));
        const result = await enrollBrowserAccount(email, password);
        tokenStore.clear();
        tokenStore.set(result.tokens, true);
        setUser(result.user);
        announceAccountChange();
      },
      register: (name, email, password) =>
        authenticate(authApi.register(name, email, password)),
      logout: async () => {
        if (browserAccountsEnabled && user) {
          try {
            await browserAuth.remove(user.id);
            await authApi.logout();
            announceAccountChange();
            reloadForAccountChange("/login");
            return;
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              error.code !== "DEVICE_SESSION_EXPIRED"
            )
              throw error;
          }
        }
        const legacyRefreshToken = getLegacyRefreshToken();
        tokenStore.clear();
        setUser(null);
        void authApi.logout(legacyRefreshToken).catch(() => {
          // The local session is already cleared. A failed network logout will
          // be retried naturally when the cookie next fails to restore.
        });
      },
      reloadUser,
    }),
    [authenticate, loading, reloadUser, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
