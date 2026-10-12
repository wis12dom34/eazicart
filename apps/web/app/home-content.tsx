/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import "./home.css";
import "./home-social-feed.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { SideNavigation } from "./components/side-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { cartApi } from "../lib/api/cart";
import { productsApi } from "../lib/api/products";
import { notificationsApi } from "../lib/api/notifications";
import { savedApi } from "../lib/api/saved";
import type { Product } from "../lib/api/types";
import { homeDesignProducts } from "./home-design";
import { HomeSocialFeed } from "./home-social-feed";
import type { ProductList } from "../lib/public-catalog";

export default function HomePage({
  initialProducts,
}: {
  initialProducts?: ProductList;
}) {
  const auth = useAuth();
  const router = useRouter();
  const products = useRequest(
    () => productsApi.list({ limit: 100 }),
    [],
    initialProducts,
  );
  const cart = useRequest(
    () => (auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined)),
    [auth.isAuthenticated],
  );
  const notifications = useRequest(
    () =>
      auth.isAuthenticated
        ? notificationsApi.list()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const items = products.data?.data ?? [];
  const sorted = [...items];
  const activeSellers = Array.from(
    new Map(
      sorted.map((product) => [product.seller.id, product.seller]),
    ).values(),
  ).slice(0, 8);
  const isSaved = (id: string) =>
    localSaved[id] ??
    saved.data?.data.some((item) => item.productId === id) ??
    false;
  const toggleSaved = async (product: Product) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    const next = !isSaved(product.id);
    setBusy(product.id);
    setFeedback("");
    try {
      if (next) await savedApi.save(product.id);
      else await savedApi.remove(product.id);
      setLocalSaved((previous) => ({ ...previous, [product.id]: next }));
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not update saved items",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <main
      className="app-shell with-nav figma-home social-home"
      data-figma-node="1247:16174"
    >
      <header className="figma-home-sticky social-home-sticky">
        <div className="figma-home-header">
          <button
            className="figma-home-avatar"
            aria-label="Open side navigation"
            onClick={() => setDrawer(true)}
          >
            <img src="/figma/profile.svg" width={36} height={36} alt="" />
          </button>
          <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
            <img src="/figma/logo.svg" width={27} height={27} alt="" />
          </Link>
          <Link
            className="figma-home-bell"
            href="/notifications"
            aria-label="Notifications"
          >
            <img src="/figma/bell.svg" width={24} height={24} alt="" />
            {notifications.data?.meta?.unreadCount ? (
              <b className="figma-home-notification-count">
                {notifications.data.meta.unreadCount}
              </b>
            ) : null}
          </Link>
        </div>
        <Link className="figma-home-search" href="/search">
          <img src="/figma/search.svg" width={18} height={18} alt="" />
          <span>Search products, stores or brands</span>
        </Link>
        <nav className="figma-home-tabs" aria-label="Product discovery">
          <Link className="active" href="/" aria-current="page">
            For You
          </Link>
          <Link href="/explore?section=trending">Trending</Link>
          <Link href="/explore">Nearby</Link>
          <Link href="/following">Following</Link>
        </nav>
      </header>

      {activeSellers.length ? (
        <section className="figma-home-stories social-home-stories" aria-label="Seller stories">
          <div className="figma-home-section-header">
            <h2>Seller Stories</h2>
            <Link href="/explore?section=sellers">View all</Link>
          </div>
          <div className="figma-home-story-strip">
            {activeSellers.map((seller) => (
              <Link
                className="figma-home-story"
                href={`/seller/${seller.id}`}
                key={seller.id}
              >
                <span className="figma-home-story-avatar" aria-hidden="true">
                  {seller.displayName.slice(0, 2).toUpperCase()}
                </span>
                <strong>{seller.displayName}</strong>
                {seller._count?.products ? (
                  <small>{seller._count.products} products</small>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {products.loading && !products.data ? (
        <div className="social-home-state">
          <LoadingState label="Loading your feed…" />
        </div>
      ) : products.error && !products.data ? (
        <div className="social-home-state">
          <ErrorState
            message={products.error}
            retry={() => void products.reload()}
          />
        </div>
      ) : sorted.length ? (
        <HomeSocialFeed
          products={sorted}
          isSaved={isSaved}
          busy={busy}
          onToggleSaved={(product) => void toggleSaved(product)}
        />
      ) : (
        <div className="social-home-state">
          <EmptyState message="No products are available yet." />
        </div>
      )}

      {sorted.length ? (
        <section className="figma-home-for-you social-home-more-products">
          <SectionHeader title="More for you" />
          <div className="figma-home-product-grid">
            {sorted.slice(0, 16).map((product) => {
              const design = homeDesignProducts.find(
                (d) =>
                  d.name === product.name &&
                  d.seller === product.seller.displayName,
              );
              return (
                <article className="figma-home-product" key={product.id}>
                  <Link
                    className="figma-home-product-media"
                    style={{ background: design?.background }}
                    href={`/product/${product.id}`}
                    aria-label={`View ${product.name}`}
                  >
                    <div>
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].altText ?? product.name}
                        />
                      ) : design ? (
                        <img
                          src={`/figma/${design.image}`}
                          alt={product.name}
                        />
                      ) : null}
                    </div>
                  </Link>
                  <button
                    className="figma-home-favourite"
                    type="button"
                    aria-label={`${isSaved(product.id) ? "Unsave" : "Save"} ${product.name}`}
                    aria-pressed={isSaved(product.id)}
                    disabled={busy === product.id}
                    onClick={() => void toggleSaved(product)}
                  >
                    <span>
                      <img
                        src={
                          isSaved(product.id)
                            ? "/figma/heart-saved.svg"
                            : "/figma/heart.svg"
                        }
                        alt=""
                        width={18}
                        height={18}
                      />
                    </span>
                  </button>
                  <div className="figma-home-product-copy">
                    <Link
                      className="figma-home-product-seller"
                      href={`/seller/${product.seller.id}`}
                    >
                      {product.seller.displayName}
                    </Link>
                    <Link
                      className="figma-home-product-title"
                      href={`/product/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <strong>{money(product.price)}</strong>
                    <div className="figma-home-product-rating">
                      <span>
                        {product.soldLabel ??
                          product.viewsLabel ??
                          (product.stock > 0
                            ? `${product.stock} in stock`
                            : "Out of stock")}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {feedback ? (
        <p role="alert" className="figma-home-feedback">
          {feedback}
        </p>
      ) : null}
      <BottomNavigation
        cartCount={cart.data?.data.items.reduce(
          (n, item) => n + item.quantity,
          0,
        )}
      />
      {drawer ? <SideNavigation onClose={closeDrawer} /> : null}
    </main>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="figma-home-section-header">
      <h2>{title}</h2>
      <Link href="/explore">See all</Link>
    </div>
  );
}
