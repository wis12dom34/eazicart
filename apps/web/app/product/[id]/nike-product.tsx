/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "../../../lib/api/types";
import { cartApi } from "../../../lib/api/cart";
import { savedApi } from "../../../lib/api/saved";
import { useAuth } from "../../providers/auth-provider";
import { money } from "../../data";
import { useRequest } from "../../hooks/use-request";
import styles from "./nike-product.module.css";

export function NikeProduct({ product }: { product: Product }) {
  const auth = useAuth();
  const router = useRouter();
  const [size, setSize] = useState(41);
  const savedItems = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [savedOverride, setSaved] = useState<boolean | null>(null);
  const saved =
    savedOverride ??
    savedItems.data?.data.some((item) => item.productId === product.id) ??
    false;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const action = async (operation: () => Promise<unknown>, success: string) => {
    if (!auth.isAuthenticated) {
      router.push(
        `/login?next=${encodeURIComponent(`/product/${product.id}`)}`,
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    try {
      if (navigator.share)
        await navigator.share({
          title: product.name,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("Product link copied");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("Unable to share product");
    }
  };
  return (
    <main className={styles.page} data-figma-node="8:54">
      <header className={styles.header}>
        <div className={styles.island} aria-hidden="true" />
        <Link href="/" className={styles.back} aria-label="Back to home">
          <img src="/figma/back.svg" alt="" />
        </Link>
        <h1>Product</h1>
        <button
          className={styles.favourite}
          aria-label={saved ? "Unsave product" : "Save product"}
          aria-pressed={saved}
          disabled={busy}
          onClick={() =>
            void action(async () => {
              if (saved) await savedApi.remove(product.id);
              else await savedApi.save(product.id);
              setSaved(!saved);
            }, "")
          }
        >
          <img
            src={saved ? "/figma/heart-saved.svg" : "/figma/heart.svg"}
            alt=""
            width={18}
            height={18}
          />
        </button>
        <button
          className={styles.share}
          aria-label="Share product"
          onClick={() => void share()}
        >
          <img src="/figma/share.svg" alt="" />
        </button>
      </header>
      <section className={styles.media} aria-label="Product gallery">
        <div className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <span>1 / 4</span>
      </section>
      <section className={styles.info}>
        <h2>{product.name}</h2>
        <strong className={styles.price}>{money(product.price)}</strong>
        <p className={styles.rating}>★ 4.8 · 1.2K sold</p>
        <Link className={styles.seller} href={`/seller/${product.seller.id}`}>
          <span className={styles.avatar} aria-hidden="true" />
          <strong>
            {product.seller.displayName}
            <span className={styles.badge}>
              <img src="/figma/verified.svg" alt="Verified seller" />
            </span>
          </strong>
          <small>Verified seller · Fast response</small>
        </Link>
        <hr />
        <h3>Select size</h3>
        <div className={styles.sizes} aria-label="Select size">
          {[40, 41, 42, 43].map((value) => (
            <button
              key={value}
              aria-pressed={size === value}
              onClick={() => setSize(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <p className={styles.protection}>
          Free delivery · Buyer protection included
        </p>
        {message && (
          <p role="status" className={styles.feedback}>
            {message}
          </p>
        )}
      </section>
      <footer className={styles.actions}>
        <button
          disabled={busy || product.stock < 1}
          onClick={() =>
            void action(() => cartApi.add(product.id, 1), "Added to cart")
          }
        >
          {busy ? "Adding…" : "Add to Cart"}
        </button>
        <button
          disabled={busy || product.stock < 1}
          onClick={() =>
            void action(async () => {
              await cartApi.add(product.id, 1);
              router.push("/checkout");
            }, "")
          }
        >
          Buy Now
        </button>
      </footer>
    </main>
  );
}
