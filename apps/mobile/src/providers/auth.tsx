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
import { SessionWriteGate } from "../lib/session-write-gate";

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
const gate = new SessionWriteGate();
let refreshInFlight: { epoch: number; promise: Promise<boolean> } | null = null;

async function persistSession(
  response: AuthResponse,
  epoch: number,
  isRefresh = false,
): Promise<boolean> {
  return gate.writeIfCurrent(epoch, async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, response.tokens.refreshToken);
    if (gate.isCurrent(epoch))
      setAccessToken(response.tokens.accessToken, { refresh: isRefresh });
  });
}

/** Invalidate immediately; queue deletion behind any in-progress token write. */
function invalidateAndClear(expectedEpoch?: number): Promise<string | null> {
  if (expectedEpoch !== undefined && !gate.isCurrent(expectedEpoch)) {
    return Promise.resolve(null);
  }
  gate.invalidate();
  setAccessToken(null);
  return gate.enqueue(async () => {
    const token = await SecureStore.getItemAsync(STORAGE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return token;
  });
}

function refresh(onUnauthorized: () => void): Promise<boolean> {
  const epoch = gate.capture();
  if (refreshInFlight?.epoch === epoch) return refreshInFlight.promise;
  const promise = (async () => {
    const token = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!token || !gate.isCurrent(epoch)) return false;
    try {
      const session = await api.session(token);
      return (
        gate.isCurrent(epoch) && (await persistSession(session, epoch, true))
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && gate.isCurrent(epoch)) {
        const clearing = invalidateAndClear(epoch);
        onUnauthorized();
        await clearing;
      }
      return false;
    }
  })().finally(() => {
    if (refreshInFlight?.epoch === epoch) refreshInFlight = null;
  });
  refreshInFlight = { epoch, promise };
  return promise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const retrySession = useCallback(async () => {
    const epoch = gate.capture();
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!gate.isCurrent(epoch)) return;
      if (token) {
        try {
          const restored = await api.session(token);
          if (!gate.isCurrent(epoch)) return;
          const saved = await persistSession(restored, epoch);
          if (!saved || !gate.isCurrent(epoch)) return;
          await clearAccountCache(queryClient);
          if (gate.isCurrent(epoch)) setUser(restored.user);
        } catch (e) {
          if (!gate.isCurrent(epoch)) return;
          if (e instanceof ApiError && e.status === 401) {
            await invalidateAndClear(epoch);
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
    setRefreshHandler(() =>
      refresh(() => {
        setUser(null);
        void clearAccountCache(queryClient).catch(() => {});
      }),
    );
    void retrySession().catch(() => setLoading(false));
    return () => setRefreshHandler(null);
  }, [queryClient, retrySession]);

  const authenticate = useCallback(
    async (promise: Promise<AuthResponse>, startingEpoch: number) => {
      const result = await promise;
      if (!gate.isCurrent(startingEpoch)) {
        throw new Error("Session changed during sign in. Please try again.");
      }
      const epoch = gate.invalidate();
      setAccessToken(null);
      setUser(null);
      await clearAccountCache(queryClient);
      let saved = false;
      try {
        saved = await persistSession(result, epoch);
      } catch (error) {
        if (gate.isCurrent(epoch)) await invalidateAndClear(epoch);
        throw error;
      }
      if (!saved || !gate.isCurrent(epoch)) {
        throw new Error("Session changed during sign in. Please try again.");
      }
      setUser(result.user);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    // Invalidate before any await so a late refresh cannot restore a signed-out account.
    const clearing = invalidateAndClear();
    setUser(null);
    await clearAccountCache(queryClient);
    const token = await clearing;
    if (token) await api.logout(token).catch(() => {});
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      retrySession,
      logout,
      login: (email, password) =>
        authenticate(api.login(email, password), gate.capture()),
      register: (name, email, password) =>
        authenticate(api.register(name, email, password), gate.capture()),
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
