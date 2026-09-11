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
import { ApiError, tokenStore } from "../../lib/api/client";
import type { User } from "../../lib/api/types";
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
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    reloadUser()
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [reloadUser]);
  const authenticate = useCallback(
    async (
      request: Promise<{
        user: User;
        tokens: {
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
        };
      }>,
    ) => {
      const result = await request;
      tokenStore.set(result.tokens);
      setUser(result.user);
      await reloadUser();
    },
    [reloadUser],
  );
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: (email, password) => authenticate(authApi.login(email, password)),
      register: (name, email, password) =>
        authenticate(authApi.register(name, email, password)),
      logout: () => {
        tokenStore.clear();
        setUser(null);
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
