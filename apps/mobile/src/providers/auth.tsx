import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, setAccessToken, setRefreshHandler } from "../lib/api";
import { createSessionPersistence } from "../lib/session-persistence";
import type { AuthResponse, User } from "../lib/types";

const STORAGE_KEY = "eazicart_mobile_refresh_v1";
type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
let refreshInFlight: Promise<boolean> | null = null;
const session = createSessionPersistence(STORAGE_KEY, SecureStore, setAccessToken);

async function refresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const stamp = session.current();
  refreshInFlight = (async () => {
    const token = await session.read(stamp);
    if (!token) return false;
    try {
      const response = await api.session(token);
      return session.persist(stamp, response.tokens);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        await session.clearIfCurrent(stamp);
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const retrySession = useCallback(async () => {
    const stamp = session.current();
    setLoading(true);
    try {
      const token = await session.read(stamp);
      if (!session.isCurrent(stamp)) return;
      if (token) {
        try {
          const restored = await api.session(token);
          if (await session.persist(stamp, restored.tokens))
            setUser(restored.user);
        } catch (e) {
          if (session.isCurrent(stamp)) setUser(null);
          if (e instanceof ApiError && e.status === 401)
            await session.clearIfCurrent(stamp);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRefreshHandler(refresh);
    void retrySession().catch(() => setLoading(false));
    return () => setRefreshHandler(null);
  }, [retrySession]);

  const authenticate = useCallback(
    async (promise: Promise<AuthResponse>, stamp: number) => {
      const result = await promise;
      if (await session.persist(stamp, result.tokens)) setUser(result.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    // Invalidate pending login, session-restore and refresh work immediately.
    // Storage deletion queues behind any write already in progress.
    const clear = session.clear();
    setUser(null);
    setLoading(false);
    const token = await clear;
    if (token) await api.logout(token).catch(() => {});
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      retrySession,
      logout,
      login: (email, password) =>
        authenticate(api.login(email, password), session.current()),
      register: (name, email, password) =>
        authenticate(api.register(name, email, password), session.current()),
    }),
    [user, loading, retrySession, logout, authenticate],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
