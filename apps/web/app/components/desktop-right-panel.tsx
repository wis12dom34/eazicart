"use client";
import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { productsApi } from "../../lib/api/products";
import { sellersApi } from "../../lib/api/sellers";
import { reelsApi } from "../../lib/api/reels";
import type { Product, Seller } from "../../lib/api/types";
import { money } from "../data";
import { Icon } from "./icon";
import { ContentImage } from "./content-image";
import styles from "./desktop-navigation.module.css";

export const DesktopRightPanel = memo(function DesktopRightPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{
    products: Product[];
    sellers: Seller[];
    trending: Product[];
  }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let requested = false;
    const media = window.matchMedia("(min-width: 1024px)");
    const load = async () => {
      if (!media.matches || requested) return;
      requested = true;
      const results = await Promise.allSettled([
        productsApi.list({ limit: 6 }),
        sellersApi.list(),
        reelsApi.feed({ limit: 20 }),
      ]);
      if (!active) return;
      const [products, sellers, reels] = results;
      if (results.some((result) => result.status === "rejected"))
        setError(true);
      const seen = new Set<string>();
      const trending =
        reels.status === "fulfilled"
          ? [...reels.value.data]
              .sort((a, b) => b._count.views - a._count.views)
              .flatMap((reel) => {
                if (!reel.product || seen.has(reel.product.id)) return [];
                seen.add(reel.product.id);
                return [reel.product];
              })
              .slice(0, 3)
          : [];
      setData({
        products: products.status === "fulfilled" ? products.value.data : [],
        sellers:
          sellers.status === "fulfilled" ? sellers.value.data.slice(0, 3) : [],
        trending,
      });
    };
    const onLoad = () => {
      void load();
    };
    onLoad();
    media.addEventListener("change", onLoad);
    return () => {
      active = false;
      media.removeEventListener("change", onLoad);
    };
  }, [retry]);
  const products = (items: Product[]) =>
    items.map((product) => (
      <Link
        className={styles.discoveryRow}
        href={`/product/${encodeURIComponent(product.id)}`}
        key={product.id}
      >
        {product.images[0]?.url ? (
          <ContentImage
            className={styles.thumb}
            src={product.images[0].url}
            alt=""
            width={52}
            height={52}
          />
        ) : (
          <span className={styles.thumb} />
        )}
        <span className={styles.discoveryCopy}>
          <strong>{product.name}</strong>
          <small className={styles.price}>{money(product.price)}</small>
        </span>
      </Link>
    ));
  return (
    <aside
      className={styles.right}
      aria-label="Discover on EaziCart"
      data-figma-node="2960:16670"
    >
      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim())
            router.push(`/search?search=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Icon name="search" size={18} />
        <input
          aria-label="Search products, sellers, brands"
          placeholder="Search products, sellers, brands"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <section className={styles.discovery}>
        <h2>Trending products</h2>
        {!data ? (
          <p role="status">Loading discovery…</p>
        ) : data.trending.length ? (
          products(data.trending)
        ) : (
          <p>No trending products yet.</p>
        )}
      </section>
      <section className={styles.discovery}>
        <h2>Suggested sellers</h2>
        {data?.sellers.map((seller) => (
          <Link
            className={styles.discoveryRow}
            href={`/seller/${encodeURIComponent(seller.id)}`}
            key={seller.id}
          >
            <span className={styles.avatar}>
              {seller.displayName[0]?.toUpperCase()}
            </span>
            <span className={styles.discoveryCopy}>
              <strong>{seller.displayName}</strong>
              <small>Visit store</small>
            </span>
          </Link>
        ))}
        {data && !data.sellers.length && <p>No sellers to suggest yet.</p>}
      </section>
      <section className={styles.discovery}>
        <h2>Recommended for you</h2>
        {data && products(data.products.slice(0, 3))}
        {data && !data.products.length && (
          <p>No recommendations available yet.</p>
        )}
      </section>
      {error && (
        <button
          className={styles.retry}
          onClick={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
        >
          Some discovery data could not load. Retry
        </button>
      )}
    </aside>
  );
});
