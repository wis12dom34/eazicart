/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productsApi } from "../../lib/api/products";
import type { Product } from "../../lib/api/types";
import { BottomNavigation } from "../components/bottom-navigation";
import { savedApi } from "../../lib/api/saved";
import { useAuth } from "../providers/auth-provider";
import { useRequest } from "../hooks/use-request";
import { useRouter } from "next/navigation";
import styles from "./reels.module.css";

const formatNaira = (value: string) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));

export default function ReelsPage() {
  const auth = useAuth();
  const router = useRouter();
  const savedItems = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [savedOverride, setSaved] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("productId");
    const request = id
      ? productsApi.get(id).then((response) => response.data)
      : productsApi
          .list({ sort: "newest", limit: 100 })
          .then(
            (response) =>
              response.data.find(
                (p) =>
                  p.name === "Nike Air Max 90" &&
                  p.seller.displayName === "Nike Official",
              ) ??
              response.data[0] ??
              null,
          );
    request
      .then((selected) => {
        if (!active) return;
        setProduct(selected);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load reels",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shareProduct = async () => {
    if (!product) return;
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Product link copied");
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      )
        return;
      setShareStatus("Unable to share product");
    }
  };

  const saved =
    savedOverride ??
    savedItems.data?.data.some((item) => item.productId === product?.id) ??
    false;
  const toggleSaved = async () => {
    if (!product) return;
    if (!auth.isAuthenticated) {
      router.push(
        `/login?next=${encodeURIComponent(`/reels?productId=${product.id}`)}`,
      );
      return;
    }
    setSaving(true);
    try {
      if (saved) await savedApi.remove(product.id);
      else await savedApi.save(product.id);
      setSaved(!saved);
    } catch (error) {
      setShareStatus(
        error instanceof Error ? error.message : "Unable to save product",
      );
    } finally {
      setSaving(false);
    }
  };
  const isNike =
    product?.name === "Nike Air Max 90" &&
    product.seller.displayName === "Nike Official";
  const image = isNike ? "/figma/nike-air-max-90.jpg" : product?.images[0]?.url;
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="223:51">
      <div className={styles.viewport}>
        {image ? (
          <img className={styles.media} src={image} alt={product?.name ?? ""} />
        ) : (
          <div
            className={styles.fallback}
            aria-label="Product media unavailable"
          />
        )}
        <div className={styles.bottomShade} />
        {loading || error || !product ? (
          <p className={styles.state} role={error ? "alert" : "status"}>
            {loading
              ? "Loading products…"
              : (error ?? "No products are available for Reels yet.")}
          </p>
        ) : (
          <>
            <div className={styles.details}>
              <Link
                className={styles.avatar}
                href={`/seller/${product.seller.id}`}
                aria-label={`View ${product.seller.displayName} seller profile`}
              />
              <Link
                className={styles.sellerName}
                href={`/seller/${product.seller.id}`}
              >
                {product.seller.displayName}
                {isNike ? "  ✓" : ""}
              </Link>
            </div>
            {product.reel?.caption || product.description ? (
              <p className={styles.caption}>
                {product.reel?.caption ?? product.description}
              </p>
            ) : null}
            <strong className={styles.productName}>{product.name}</strong>
            <Link
              className={styles.viewProduct}
              href={`/product/${product.id}`}
            >
              <strong>{formatNaira(product.price)}</strong>
              <span>View Product</span>
            </Link>
            <div className={styles.actions}>
              <button
                className={styles.action}
                disabled
                aria-label="Like reel: service unavailable"
              >
                <i>
                  <img
                    src="/figma/reel-like.svg"
                    width={20}
                    height={20}
                    alt=""
                  />
                </i>
                <span>{product.reel?.likesLabel ?? "—"}</span>
              </button>
              <button
                className={styles.action}
                disabled
                aria-label="Reel comments: service unavailable"
              >
                <i>
                  <img
                    src="/figma/reel-comment.svg"
                    width={20}
                    height={20}
                    alt=""
                  />
                </i>
                <span>{product.reel?.commentsLabel ?? "—"}</span>
              </button>
              <button
                className={styles.action}
                aria-label={saved ? "Unsave product" : "Save product"}
                aria-pressed={saved}
                disabled={saving}
                onClick={() => void toggleSaved()}
              >
                <i>
                  <img
                    src="/figma/reel-save.svg"
                    width={20}
                    height={20}
                    alt=""
                  />
                </i>
                <small>{saved ? "Saved" : "Save"}</small>
              </button>
              <button
                className={styles.action}
                onClick={() => void shareProduct()}
                aria-label={`Share ${product.name}`}
              >
                <i>
                  <img
                    src="/figma/reel-share.svg"
                    width={20}
                    height={20}
                    alt=""
                  />
                </i>
                <small>Share</small>
              </button>
              <Link
                className={styles.action}
                href="/cart"
                aria-label="Open cart"
              >
                <i>
                  <img
                    src="/figma/reel-cart.svg"
                    width={22}
                    height={22}
                    alt=""
                  />
                </i>
                <small>Cart</small>
              </Link>
            </div>
          </>
        )}
        {shareStatus ? (
          <span className={styles.shareStatus} role="status">
            {shareStatus}
          </span>
        ) : null}
      </div>
      <div className={styles.topShade} />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to home">
          <img src="/figma/reel-back.svg" width={20} height={20} alt="" />
        </Link>
        <h1>Reels</h1>
        <Link
          href="/explore"
          className={styles.search}
          aria-label="Search products"
        >
          <img src="/figma/reel-search.svg" width={20} height={20} alt="" />
        </Link>
      </header>
      <BottomNavigation />
    </main>
  );
}
