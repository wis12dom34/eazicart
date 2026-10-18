"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/auth-provider";
import {
  productSocialApi,
  type ProductSocial,
} from "../../lib/api/product-social";

const EVENT = "eazicart:product-social";
const pending = new Map<string, Promise<{ data: ProductSocial }>>();
const cache = new Map<string, { data: ProductSocial; at: number }>();
const CACHE_MS = 60_000;
export function notifyProductSocial(productId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { productId } }));
}
export function useProductSocial(
  productId: string,
  initialData?: ProductSocial,
) {
  const auth = useAuth(),
    router = useRouter();
  const cacheKey = JSON.stringify([auth.user?.id, productId]);
  const cached = cache.get(cacheKey);
  const freshCached = cached && Date.now() - cached.at < CACHE_MS ? cached.data : null;
  const seeded = freshCached ?? initialData ?? null;
  const [data, setData] = useState<ProductSocial | null>(seeded),
    [loading, setLoading] = useState(!seeded),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false);
  const account = auth.user?.id;
  useEffect(() => {
    if (auth.loading) return;
    let active = true,
      version = 0;
    const load = () => {
      const current = ++version;
      const key = JSON.stringify([account, productId]);
      let request = pending.get(key);
      if (!request) {
        request = productSocialApi.get(productId, Boolean(account));
        pending.set(key, request);
        void request
          .finally(() => {
            if (pending.get(key) === request) pending.delete(key);
          })
          .catch(() => undefined);
      }
      void request
        .then((result) => {
          if (active && current === version) {
            cache.set(key, { data: result.data, at: Date.now() });
            setData(result.data);
            setError("");
          }
        })
        .catch((e: unknown) => {
          if (active && current === version)
            setError(
              e instanceof Error
                ? e.message
                : "Could not load product activity",
            );
        })
        .finally(() => {
          if (active && current === version) setLoading(false);
        });
    };
    const key = JSON.stringify([account, productId]);
    const existing = cache.get(key);
    const fresh = existing && Date.now() - existing.at < CACHE_MS ? existing.data : null;
    const seed = fresh ?? initialData ?? null;
    if (seed) {
      cache.set(key, { data: seed, at: Date.now() });
      setData(seed);
      setLoading(false);
      // Anonymous product social state is already embedded in the server FYP.
      // Do not immediately refetch the same likes/comments after hydration.
      if (account && initialData && !fresh) load();
    } else { setData(null); setLoading(true); load(); }
    const update = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          productId: string;
          data?: ProductSocial;
          account?: string;
        }>
      ).detail;
      if (detail?.productId !== productId) return;
      if (detail.data && detail.account === account) {
        version++;
        cache.set(JSON.stringify([account, productId]), { data: detail.data, at: Date.now() });
        setData(detail.data);
        setError("");
        setLoading(false);
      } else {
        pending.delete(JSON.stringify([account, productId]));
        load();
      }
    };
    window.addEventListener(EVENT, update);
    return () => {
      active = false;
      window.removeEventListener(EVENT, update);
    };
  }, [account, auth.loading, productId, initialData]);
  const toggleLike = async () => {
    if (auth.loading || guard.current) return;
    if (!account) {
      router.push(
        "/login?next=" +
          encodeURIComponent(
            window.location.pathname +
              window.location.search +
              window.location.hash,
          ),
      );
      return;
    }
    if (!data) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await productSocialApi.like(productId, !data.liked);
      setData(result.data);
      window.dispatchEvent(
        new CustomEvent(EVENT, {
          detail: { productId, data: result.data, account },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update like");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  return { data, loading, busy, error, toggleLike };
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]