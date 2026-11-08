import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { clearAccountCache } from "../lib/session-cache";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, setAccessToken, setRefreshHandler } from "../lib/api";
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

async function persistSession(response: AuthResponse) {
  await SecureStore.setItemAsync(STORAGE_KEY, response.tokens.refreshToken);
  setAccessToken(response.tokens.accessToken);
}
async function clearSession() {
  setAccessToken(null);
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
async function refresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const token = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!token) return false;
    try {
      const session = await api.session(token);
      await persistSession(session);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await clearSession();
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const retrySession = useCallback(async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY);
      if (token) {
        try {
          const restored = await api.session(token);
          await clearAccountCache(queryClient);
          await persistSession(restored);
          setUser(restored.user);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await clearSession();
            await clearAccountCache(queryClient);
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    setRefreshHandler(refresh);
    void retrySession().catch(() => setLoading(false));
    return () => setRefreshHandler(null);
  }, [retrySession]);

  const authenticate = useCallback(
    async (promise: Promise<AuthResponse>) => {
      const result = await promise;
      // Do not expose cached data from a different signed-in account.
      if (user?.id !== result.user.id) {
        await clearAccountCache(queryClient);
      }
      await persistSession(result);
      setUser(result.user);
    },
    [queryClient, user?.id],
  );

  const logout = useCallback(async () => {
    const token = await SecureStore.getItemAsync(STORAGE_KEY);
    // Revoke local access and stop outstanding private reads before logout I/O.
    setAccessToken(null);
    setUser(null);
    await clearAccountCache(queryClient);
    try {
      await clearSession();
    } finally {
      if (token) await api.logout(token).catch(() => {});
    }
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      retrySession,
      logout,
      login: (email, password) => authenticate(api.login(email, password)),
      register: (name, email, password) =>
        authenticate(api.register(name, email, password)),
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
