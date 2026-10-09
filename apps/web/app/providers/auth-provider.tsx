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
import { authApi } from "../../lib/api/auth";
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
  logout(): void;
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
    // HttpOnly refresh cookies cannot be inspected from JavaScript, so ask the
    // API to restore the session. apiRequest performs one refresh-and-retry.
    reloadUser()
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
      login: (email, password) => authenticate(authApi.login(email, password)),
      register: (name, email, password) =>
        authenticate(authApi.register(name, email, password)),
      logout: () => {
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
